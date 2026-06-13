import React, { memo } from 'react';
import { TerminalSquareIcon } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useLocalize, useHasAccess, useModelCapability } from '~/hooks';
import { useBadgeRowContext, useChatContext } from '~/Providers';

function CodeInterpreter() {
  const localize = useLocalize();
  const context = useBadgeRowContext();
  const { conversation } = useChatContext();
  const { toggleState: runCode, debouncedChange, isPinned } = context?.codeInterpreter ?? {};

  const canRunCode = useHasAccess({
    permissionType: PermissionTypes.RUN_CODE,
    permission: Permissions.USE,
  });

  const capability = useModelCapability(
    conversation?.endpoint,
    conversation?.model,
    conversation?.endpointType,
  );

  if (!canRunCode) {
    return null;
  }

  if (capability != null && !capability.code_interpreter) {
    return null;
  }

  return (
    (runCode || isPinned) && (
      <CheckboxButton
        className="max-w-fit"
        checked={runCode}
        setValue={debouncedChange}
        label={localize('com_ui_run_code')}
        isCheckedClassName="border-purple-600/40 bg-purple-500/10 hover:bg-purple-700/10"
        icon={<TerminalSquareIcon className="icon-md" aria-hidden="true" />}
      />
    )
  );
}

export default memo(CodeInterpreter);
