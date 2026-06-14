import download from 'downloadjs';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import exportFromJSON from 'export-from-json';
import {
  buildTree,
  ContentTypes,
  ToolCallTypes,
  imageGenTools,
  isImageVisionTool,
  useExportConversation as useExportConversationQuery,
  type PublicMessage,
  type PublicContentPart,
  type TExportConversationResponse,
} from 'librechat-data-provider';
import type {
  TConversation,
  TPreset,
} from 'librechat-data-provider';
import { useScreenshot } from '~/hooks/ScreenshotContext';
import { useLocalize } from '~/hooks';
import { cleanupPreset } from '~/utils';

type ExportValues = {
  fieldName: string;
  fieldValues: string[];
};
type ExportEntries = ExportValues[];

export default function useExportConversation({
  conversation,
  filename,
  type,
  includeOptions,
  exportBranches,
  recursive,
}: {
  conversation: TConversation | null;
  filename: string;
  type: string;
  includeOptions: boolean | 'indeterminate';
  exportBranches: boolean | 'indeterminate';
  recursive: boolean | 'indeterminate';
}) {
  const { captureScreenshot } = useScreenshot();
  const localize = useLocalize();

  const { conversationId: paramId } = useParams();
  const effectiveConvoId =
    paramId === 'new' ? paramId : (conversation?.conversationId ?? paramId ?? '');

  const { refetch: fetchExportData } = useExportConversationQuery(
    effectiveConvoId && effectiveConvoId !== 'new' ? effectiveConvoId : '',
    { enabled: false },
  );

  const getMessageText = (message: Partial<PublicMessage> | undefined, format = 'text') => {
    if (!message) {
      return '';
    }

    const formatText = (sender: string, text: string) => {
      if (format === 'text') {
        return `>> ${sender}:\n${text}`;
      }
      return `**${sender}**\n${text}`;
    };

    if (!message.content) {
      return formatText(message.sender || '', message.text || '');
    }

    return message.content
      .filter((content) => content != null)
      .map((content) => getMessageContent(message.sender || '', content))
      .filter((text) => text.length > 0)
      .map((text) => {
        return formatText(text[0], text[1]);
      })
      .join('\n\n\n');
  };

  const getMessageContent = (sender: string, content?: PublicContentPart): string[] => {
    if (!content) {
      return [];
    }

    if (content.type === ContentTypes.ERROR) {
      const text = (content as { text?: string | { value?: string } }).text;
      return [
        sender,
        typeof text === 'object' ? (text.value ?? '') : (text ?? ''),
      ];
    }

    if (content.type === ContentTypes.TEXT) {
      const textPart = (content as { text?: string | { value?: string } }).text;
      const text = typeof textPart === 'string' ? textPart : (textPart?.value ?? '');
      if (text.trim().length === 0) {
        return [];
      }
      return [sender, text];
    }

    if (content.type === ContentTypes.TOOL_CALL) {
      const toolCall = (content as { tool_call: { type: string; [k: string]: unknown } }).tool_call;
      const type = toolCall?.type;

      if (type === ToolCallTypes.CODE_INTERPRETER) {
        const code_interpreter = toolCall[ToolCallTypes.CODE_INTERPRETER];
        return [localize('com_ui_run_code'), JSON.stringify(code_interpreter)];
      }

      if (type === ToolCallTypes.RETRIEVAL) {
        return ['Retrieval', JSON.stringify(toolCall)];
      }

      const func = toolCall.function as { name?: string } | undefined;
      if (
        type === ToolCallTypes.FUNCTION &&
        func?.name &&
        imageGenTools.has(func.name)
      ) {
        return ['Tool', JSON.stringify(toolCall)];
      }

      if (type === ToolCallTypes.FUNCTION) {
        if (isImageVisionTool(toolCall as never)) {
          return ['Tool', JSON.stringify(toolCall)];
        }
        return ['Tool', JSON.stringify(toolCall)];
      }
    }

    if (content.type === ContentTypes.IMAGE_FILE) {
      const imageFile = (content as { image_file: unknown }).image_file;
      return ['Image', JSON.stringify(imageFile)];
    }

    return [sender, JSON.stringify(content)];
  };

  const buildExportMessages = (exportData: TExportConversationResponse): PublicMessage[] => {
    const messagesWithChildren = [...exportData.messages] as Array<
      PublicMessage & { children?: PublicMessage[] }
    >;

    const dataTree = buildTree({ messages: messagesWithChildren });
    if (!dataTree || dataTree.length === 0) {
      return exportData.messages;
    }

    const flatten = (nodes: PublicMessage[], acc: PublicMessage[] = []) => {
      for (const node of nodes) {
        acc.push(node);
        const children = (node as { children?: PublicMessage[] }).children;
        if (children && children.length > 0 && Boolean(exportBranches)) {
          flatten(children, acc);
        }
      }
      return acc;
    };

    if (Boolean(recursive) && Boolean(exportBranches)) {
      return dataTree as PublicMessage[];
    }

    return flatten(dataTree as PublicMessage[]);
  };

  const exportScreenshot = async () => {
    let data;
    try {
      data = await captureScreenshot();
    } catch (err) {
      console.error('Failed to capture screenshot');
      return console.error(err);
    }
    download(data, `${filename}.png`, 'image/png');
  };

  const exportCSV = async (exportData: TExportConversationResponse) => {
    const messages = buildExportMessages(exportData);
    const data: Partial<PublicMessage>[] = messages.filter(Boolean);

    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'csv',
      exportType: exportFromJSON.types.csv,
      beforeTableEncode: (entries: ExportEntries | undefined) => [
        {
          fieldName: 'sender',
          fieldValues: entries?.find((e) => e.fieldName == 'sender')?.fieldValues ?? [],
        },
        {
          fieldName: 'text',
          fieldValues: entries?.find((e) => e.fieldName == 'text')?.fieldValues ?? [],
        },
        {
          fieldName: 'isCreatedByUser',
          fieldValues: entries?.find((e) => e.fieldName == 'isCreatedByUser')?.fieldValues ?? [],
        },
        {
          fieldName: 'error',
          fieldValues: entries?.find((e) => e.fieldName == 'error')?.fieldValues ?? [],
        },
        {
          fieldName: 'unfinished',
          fieldValues: entries?.find((e) => e.fieldName == 'unfinished')?.fieldValues ?? [],
        },
        {
          fieldName: 'messageId',
          fieldValues: entries?.find((e) => e.fieldName == 'messageId')?.fieldValues ?? [],
        },
        {
          fieldName: 'parentMessageId',
          fieldValues: entries?.find((e) => e.fieldName == 'parentMessageId')?.fieldValues ?? [],
        },
        {
          fieldName: 'createdAt',
          fieldValues: entries?.find((e) => e.fieldName == 'createdAt')?.fieldValues ?? [],
        },
      ],
    });
  };

  const exportMarkdown = async (exportData: TExportConversationResponse) => {
    const convo = exportData.conversation;
    let data =
      '# Conversation\n' +
      `- conversationId: ${convo.conversationId}\n` +
      `- endpoint: ${convo.endpoint}\n` +
      `- title: ${convo.title}\n` +
      `- exportAt: ${new Date().toTimeString()}\n`;

    if (includeOptions === true) {
      data += '\n## Options\n';
      const options = cleanupPreset({ preset: conversation as TPreset });

      for (const key of Object.keys(options)) {
        data += `- ${key}: ${options[key]}\n`;
      }
    }

    const messages = buildExportMessages(exportData);

    data += '\n## History\n';
    for (const message of messages) {
      data += `${getMessageText(message, 'md')}\n`;
      if (message?.error) {
        data += '*(This is an error message)*\n';
      }
      if (message?.unfinished === true) {
        data += '*(This is an unfinished message)*\n';
      }
      data += '\n\n';
    }

    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'md',
      exportType: exportFromJSON.types.txt,
    });
  };

  const exportText = async (exportData: TExportConversationResponse) => {
    const convo = exportData.conversation;
    let data =
      'Conversation\n' +
      '########################\n' +
      `conversationId: ${convo.conversationId}\n` +
      `endpoint: ${convo.endpoint}\n` +
      `title: ${convo.title}\n` +
      `exportAt: ${new Date().toTimeString()}\n`;

    if (includeOptions === true) {
      data += '\nOptions\n########################\n';
      const options = cleanupPreset({ preset: conversation as TPreset });

      for (const key of Object.keys(options)) {
        data += `${key}: ${options[key]}\n`;
      }
    }

    const messages = buildExportMessages(exportData);

    data += '\nHistory\n########################\n';
    for (const message of messages) {
      data += `${getMessageText(message)}\n`;
      if (message?.error) {
        data += '(This is an error message)\n';
      }
      if (message?.unfinished === true) {
        data += '(This is an unfinished message)\n';
      }
      data += '\n\n';
    }

    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'txt',
      exportType: exportFromJSON.types.txt,
    });
  };

  const exportJSON = async (exportData: TExportConversationResponse) => {
    const convo = exportData.conversation;
    const data = {
      conversationId: convo.conversationId,
      endpoint: convo.endpoint,
      title: convo.title,
      exportAt: new Date().toTimeString(),
      branches: exportBranches,
      recursive: recursive,
    } as Record<string, unknown>;

    if (includeOptions === true) {
      data['options'] = cleanupPreset({ preset: conversation as TPreset });
    }

    if (exportData.warnings && exportData.warnings.length > 0) {
      data['warnings'] = exportData.warnings;
    }

    const messages = buildExportMessages(exportData);

    if (Boolean(recursive) === true && !Array.isArray(messages) === false) {
      const root = { ...messages[0] };
      data['messagesTree'] = (root as { children?: PublicMessage[] }).children;
    } else {
      data['messages'] = messages;
    }

    const jsonString = JSON.stringify(data);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    download(blob, `${filename}.json`, 'application/json');
  };

  const exportConversation = useCallback(async () => {
    if (type === 'screenshot') {
      return exportScreenshot();
    }

    if (!effectiveConvoId || effectiveConvoId === 'new') {
      console.error('Cannot export: no valid conversationId');
      return;
    }

    const result = await fetchExportData();
    if (!result.data) {
      console.error('Failed to fetch export data from server');
      return;
    }

    const exportData = result.data;

    if (type === 'json') {
      await exportJSON(exportData);
    } else if (type === 'text') {
      await exportText(exportData);
    } else if (type === 'markdown') {
      await exportMarkdown(exportData);
    } else if (type === 'csv') {
      await exportCSV(exportData);
    }
  }, [type, effectiveConvoId, fetchExportData]);

  return { exportConversation };
}
