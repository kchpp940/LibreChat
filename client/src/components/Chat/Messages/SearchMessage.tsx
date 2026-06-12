import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import { SearchHitType, type SearchHit } from 'librechat-data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import type { TMessageProps, TMessageIcon } from '~/common';
import MinimalHoverButtons from '~/components/Chat/Messages/MinimalHoverButtons';
import Icon from '~/components/Chat/Messages/MessageIcon';
import SearchContent from './Content/SearchContent';
import { fontSizeAtom } from '~/store/fontSize';
import SearchButtons from './SearchButtons';
import SubRow from './SubRow';
import { cn } from '~/utils';
import store from '~/store';

const HitTypeBadge = ({ type, localize }: { type: SearchHitType; localize: (key: string) => string }) => {
  const badgeStyles: Record<SearchHitType, string> = {
    [SearchHitType.TEXT]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    [SearchHitType.TOOL_CALL]: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    [SearchHitType.TOOL_OUTPUT]: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
    [SearchHitType.ATTACHMENT]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    [SearchHitType.ARTIFACT]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    [SearchHitType.ERROR]: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    [SearchHitType.FILE]: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  };

  const labelMap: Record<SearchHitType, string> = {
    [SearchHitType.TEXT]: 'com_nav_search_text',
    [SearchHitType.TOOL_CALL]: 'com_nav_search_tool_call',
    [SearchHitType.TOOL_OUTPUT]: 'com_nav_search_tool_output',
    [SearchHitType.ATTACHMENT]: 'com_nav_search_attachment',
    [SearchHitType.ARTIFACT]: 'com_nav_search_artifact',
    [SearchHitType.ERROR]: 'com_nav_search_error',
    [SearchHitType.FILE]: 'com_nav_search_file',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', badgeStyles[type])}>
      {localize(labelMap[type])}
    </span>
  );
};

const SearchHitsSummary = ({ hits, localize }: { hits: SearchHit[]; localize: (key: string) => string }) => {
  if (!hits || hits.length === 0) {
    return null;
  }

  const uniqueTypes = [...new Set(hits.map((hit) => hit.type))];

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex flex-wrap gap-1.5">
        {uniqueTypes.map((type) => (
          <HitTypeBadge key={type} type={type} localize={localize} />
        ))}
      </div>
      <div className="space-y-1.5">
        {hits.slice(0, 3).map((hit, index) => (
          <div key={index} className="text-sm">
            <div className="text-gray-500 dark:text-gray-400">
              {hit.toolName && <span className="font-medium">{hit.toolName} · </span>}
              {hit.fileName && <span className="font-medium">{hit.fileName} · </span>}
              {hit.artifactTitle && <span className="font-medium">{hit.artifactTitle} · </span>}
            </div>
            <p className="line-clamp-2 text-gray-700 dark:text-gray-300">{hit.snippet}</p>
          </div>
        ))}
        {hits.length > 3 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {localize('com_nav_search_more_hits', { count: hits.length - 3 })}
          </p>
        )}
      </div>
    </div>
  );
};

const MessageAvatar = ({ iconData }: { iconData: TMessageIcon }) => (
  <div className="relative flex flex-shrink-0 flex-col items-end">
    <div className="pt-0.5">
      <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
        <Icon iconData={iconData} />
      </div>
    </div>
  </div>
);

const MessageBody = ({
  message,
  messageLabel,
  fontSize,
  searchHits,
  localize,
}: {
  message: TMessageProps['message'];
  messageLabel: string;
  fontSize: string;
  searchHits?: SearchHit[];
  localize: (key: string, vars?: Record<string, unknown>) => string;
}) => (
  <div
    className={cn('relative flex w-11/12 flex-col', message.isCreatedByUser ? '' : 'agent-turn')}
  >
    <div className={cn('select-none font-semibold', fontSize)}>{messageLabel}</div>
    <SearchContent message={message} />
    {searchHits && searchHits.length > 0 && <SearchHitsSummary hits={searchHits} localize={localize} />}
    <SubRow classes="text-xs">
      <MinimalHoverButtons message={message} />
      <SearchButtons message={message} />
    </SubRow>
  </div>
);

export default function SearchMessage({
  message,
  searchHits,
}: Pick<TMessageProps, 'message'> & { searchHits?: SearchHit[] }) {
  const fontSize = useAtomValue(fontSizeAtom);
  const UsernameDisplay = useRecoilValue<boolean>(store.UsernameDisplay);
  const { user } = useAuthContext();
  const localize = useLocalize();

  const iconData: TMessageIcon = useMemo(
    () => ({
      endpoint: message?.endpoint ?? '',
      model: message?.model ?? '',
      iconURL: message?.iconURL ?? '',
      isCreatedByUser: message?.isCreatedByUser ?? false,
    }),
    [message?.endpoint, message?.model, message?.iconURL, message?.isCreatedByUser],
  );

  const messageLabel = useMemo(() => {
    if (message?.isCreatedByUser) {
      return UsernameDisplay
        ? (user?.name ?? '') || (user?.username ?? '')
        : localize('com_user_message');
    }
    return message?.sender ?? '';
  }, [
    message?.isCreatedByUser,
    message?.sender,
    UsernameDisplay,
    user?.name,
    user?.username,
    localize,
  ]);

  if (!message) {
    return null;
  }

  return (
    <div className="text-token-text-primary w-full bg-transparent">
      <div className="m-auto p-4 py-2 md:gap-6">
        <div className="final-completion group mx-auto flex flex-1 gap-3 md:max-w-3xl md:px-5 lg:max-w-[40rem] lg:px-1 xl:max-w-[48rem] xl:px-5">
          <MessageAvatar iconData={iconData} />
          <MessageBody
            message={message}
            messageLabel={messageLabel}
            fontSize={fontSize}
            searchHits={searchHits}
            localize={localize}
          />
        </div>
      </div>
    </div>
  );
}
