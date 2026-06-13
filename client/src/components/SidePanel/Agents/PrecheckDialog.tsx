import { AlertTriangle, XCircle, Info } from 'lucide-react';
import { OGDialog, OGDialogTemplate, Button } from '@librechat/client';
import { PrecheckSeverity, PrecheckCategory } from 'librechat-data-provider';
import type { PrecheckItem } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks/useLocalize';

const categoryLabelKeys: Record<string, TranslationKeys> = {
  [PrecheckCategory.REQUIRED_FIELDS]: 'com_agents_precheck_category_required',
  [PrecheckCategory.MODEL_AVAILABILITY]: 'com_agents_precheck_category_model',
  [PrecheckCategory.TOOL_PERMISSIONS]: 'com_agents_precheck_category_tools',
  [PrecheckCategory.MCP_STATUS]: 'com_agents_precheck_category_mcp',
  [PrecheckCategory.FILE_INDEX]: 'com_agents_precheck_category_files',
  [PrecheckCategory.AGENT_REFERENCES]: 'com_agents_precheck_category_agents',
};

function getSeverityIcon(severity: PrecheckSeverity) {
  if (severity === PrecheckSeverity.ERROR) {
    return <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />;
  }
  if (severity === PrecheckSeverity.WARNING) {
    return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-500" />;
  }
  return <Info className="h-4 w-4 flex-shrink-0 text-blue-500" />;
}

function groupByCategory(items: PrecheckItem[]): Map<string, PrecheckItem[]> {
  const map = new Map<string, PrecheckItem[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export default function PrecheckDialog({
  isOpen,
  onOpenChange,
  items,
  onProceed,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: PrecheckItem[];
  onProceed: () => void;
}) {
  const localize = useLocalize();

  const errors = items.filter((i) => i.severity === PrecheckSeverity.ERROR);
  const warnings = items.filter((i) => i.severity === PrecheckSeverity.WARNING);
  const hasErrors = errors.length > 0;

  const grouped = groupByCategory(items);

  return (
    <OGDialog open={isOpen} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        className="w-11/12 sm:w-[540px]"
        title={localize('com_agents_precheck_title')}
        main={
          <div className="max-h-[60vh] overflow-y-auto">
            {hasErrors && (
              <div className="mb-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 dark:bg-red-900/20">
                <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {localize('com_agents_precheck_errors_count', { count: errors.length })}
                </span>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 dark:bg-yellow-900/20">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  {localize('com_agents_precheck_warnings_count', { count: warnings.length })}
                </span>
              </div>
            )}

            {[...grouped.entries()].map(([category, categoryItems]) => {
              const labelKey = categoryLabelKeys[category];
              return (
                <div key={category} className="mb-3">
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    {labelKey ? localize(labelKey) : category}
                  </h4>
                <div className="space-y-1.5">
                  {categoryItems.map((item, idx) => (
                    <div
                      key={`${item.category}-${idx}`}
                      className="flex items-start gap-2 rounded-md border border-border-light px-3 py-2"
                    >
                      {getSeverityIcon(item.severity)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">{item.message}</p>
                        {item.detail && (
                          <p className="mt-0.5 text-xs text-text-secondary">{item.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        }
        selection={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {localize(hasErrors ? 'com_ui_close' : 'com_ui_cancel')}
            </Button>
            {!hasErrors && (
              <Button
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => {
                  onOpenChange(false);
                  onProceed();
                }}
              >
                {localize('com_agents_precheck_proceed')}
              </Button>
            )}
          </div>
        }
        showCancelButton={false}
      />
    </OGDialog>
  );
}
