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
  dataService,
} from 'librechat-data-provider';
import type {
  TMessageContentParts,
  TConversation,
  PublicMessage,
  TPreset,
  TExportConversationResponse,
} from 'librechat-data-provider';
import useBuildMessageTree from '~/hooks/Messages/useBuildMessageTree';
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
  const buildMessageTree = useBuildMessageTree();
  const localize = useLocalize();

  const { conversationId: paramId } = useParams();

  /**
   * Unified export data fetcher — all export formats must go through this
   * to guarantee the serializeForExport policy (not serializeForDisplay).
   * This prevents export/disaply口径 mixups where exports accidentally
   * consume whatever happens to be cached for the UI.
   */
  const fetchExportData = useCallback(async (): Promise<TExportConversationResponse | null> => {
    const queryParam =
      paramId === 'new' ? paramId : (conversation?.conversationId ?? paramId ?? '');
    if (!queryParam || queryParam === 'new') {
      console.error('Cannot export: no valid conversationId');
      return null;
    }
    try {
      return await dataService.exportConversation(queryParam);
    } catch (error) {
      console.error('Failed to fetch export data:', error);
      return null;
    }
  }, [paramId, conversation?.conversationId]);

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

  /**
   * Format and return message texts according to the type of content.
   * Currently, content whose type is `TOOL_CALL` basically returns JSON as is.
   * In the future, different formatted text may be returned for each type.
   */
  const getMessageContent = (sender: string, content?: TMessageContentParts): string[] => {
    if (!content) {
      return [];
    }

    if (content.type === ContentTypes.ERROR) {
      // ERROR
      return [
        sender,
        typeof content[ContentTypes.TEXT] === 'object'
          ? (content[ContentTypes.TEXT].value ?? '')
          : (content[ContentTypes.TEXT] ?? ''),
      ];
    }

    if (content.type === ContentTypes.TEXT) {
      // TEXT
      const textPart = content[ContentTypes.TEXT];
      const text = typeof textPart === 'string' ? textPart : (textPart?.value ?? '');
      if (text.trim().length === 0) {
        return [];
      }
      return [sender, text];
    }

    if (content.type === ContentTypes.TOOL_CALL) {
      const type = content[ContentTypes.TOOL_CALL].type;

      if (type === ToolCallTypes.CODE_INTERPRETER) {
        // CODE_INTERPRETER
        const toolCall = content[ContentTypes.TOOL_CALL];
        const code_interpreter = toolCall[ToolCallTypes.CODE_INTERPRETER];
        return [localize('com_ui_run_code'), JSON.stringify(code_interpreter)];
      }

      if (type === ToolCallTypes.RETRIEVAL) {
        // RETRIEVAL
        const toolCall = content[ContentTypes.TOOL_CALL];
        return ['Retrieval', JSON.stringify(toolCall)];
      }

      if (
        type === ToolCallTypes.FUNCTION &&
        imageGenTools.has(content[ContentTypes.TOOL_CALL].function.name)
      ) {
        // IMAGE_GENERATION
        const toolCall = content[ContentTypes.TOOL_CALL];
        return ['Tool', JSON.stringify(toolCall)];
      }

      if (type === ToolCallTypes.FUNCTION) {
        // IMAGE_VISION
        const toolCall = content[ContentTypes.TOOL_CALL];
        if (isImageVisionTool(toolCall)) {
          return ['Tool', JSON.stringify(toolCall)];
        }
        return ['Tool', JSON.stringify(toolCall)];
      }
    }

    if (content.type === ContentTypes.IMAGE_FILE) {
      // IMAGE
      const imageFile = content[ContentTypes.IMAGE_FILE];
      return ['Image', JSON.stringify(imageFile)];
    }

    return [sender, JSON.stringify(content)];
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

  const exportCSV = async () => {
    const exportData = await fetchExportData();
    if (!exportData) {
      return;
    }

    const data: Partial<PublicMessage>[] = [];

    const messages = await buildMessageTree({
      messageId: exportData.conversationId,
      message: null,
      messages: buildTree({ messages: exportData.messages }),
      branches: Boolean(exportBranches),
      recursive: false,
    });

    if (Array.isArray(messages)) {
      for (const message of messages) {
        if (!message) {
          continue;
        }
        data.push(message);
      }
    } else {
      data.push(messages);
    }

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

  const exportMarkdown = async () => {
    const exportData = await fetchExportData();
    if (!exportData) {
      return;
    }

    let data =
      '# Conversation\n' +
      `- conversationId: ${exportData.conversationId}\n` +
      `- endpoint: ${exportData.endpoint ?? ''}\n` +
      `- title: ${exportData.title ?? ''}\n` +
      `- exportAt: ${exportData.exportAt}\n`;

    if (includeOptions === true) {
      data += '\n## Options\n';
      const options = cleanupPreset({ preset: conversation as TPreset });

      for (const key of Object.keys(options)) {
        data += `- ${key}: ${options[key]}\n`;
      }
    }

    const messages = await buildMessageTree({
      messageId: exportData.conversationId,
      message: null,
      messages: buildTree({ messages: exportData.messages }),
      branches: false,
      recursive: false,
    });

    data += '\n## History\n';
    if (Array.isArray(messages)) {
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
    } else {
      data += `${getMessageText(messages, 'md')}\n`;
      if (messages.error) {
        data += '*(This is an error message)*\n';
      }
      if (messages.unfinished === true) {
        data += '*(This is an unfinished message)*\n';
      }
    }

    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'md',
      exportType: exportFromJSON.types.txt,
    });
  };

  const exportText = async () => {
    const exportData = await fetchExportData();
    if (!exportData) {
      return;
    }

    let data =
      'Conversation\n' +
      '########################\n' +
      `conversationId: ${exportData.conversationId}\n` +
      `endpoint: ${exportData.endpoint ?? ''}\n` +
      `title: ${exportData.title ?? ''}\n` +
      `exportAt: ${exportData.exportAt}\n`;

    if (includeOptions === true) {
      data += '\nOptions\n########################\n';
      const options = cleanupPreset({ preset: conversation as TPreset });

      for (const key of Object.keys(options)) {
        data += `${key}: ${options[key]}\n`;
      }
    }

    const messages = await buildMessageTree({
      messageId: exportData.conversationId,
      message: null,
      messages: buildTree({ messages: exportData.messages }),
      branches: false,
      recursive: false,
    });

    data += '\nHistory\n########################\n';
    if (Array.isArray(messages)) {
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
    } else {
      data += `${getMessageText(messages)}\n`;
      if (messages.error) {
        data += '(This is an error message)\n';
      }
      if (messages.unfinished === true) {
        data += '(This is an unfinished message)\n';
      }
    }

    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'txt',
      exportType: exportFromJSON.types.txt,
    });
  };

  const exportJSON = async () => {
    const exportData = await fetchExportData();
    if (!exportData) {
      return;
    }

    const data: Record<string, unknown> = {
      conversationId: exportData.conversationId,
      endpoint: exportData.endpoint,
      title: exportData.title,
      exportAt: exportData.exportAt,
    };

    if (includeOptions === true) {
      data['options'] = cleanupPreset({ preset: conversation as TPreset });
    }

    if (Boolean(exportBranches) || Boolean(recursive)) {
      const messagesTree = await buildMessageTree({
        messageId: exportData.conversationId,
        message: null,
        messages: exportData.messages,
        branches: Boolean(exportBranches),
        recursive: Boolean(recursive),
      });
      if (Boolean(recursive) && !Array.isArray(messagesTree)) {
        data['messagesTree'] = (messagesTree as { children?: PublicMessage[] }).children;
      } else {
        data['messages'] = messagesTree;
      }
    } else {
      data['messages'] = exportData.messages;
    }

    /** Use JSON.stringify without indentation to minimize file size for deeply nested recursive exports */
    const jsonString = JSON.stringify(data);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    download(blob, `${filename}.json`, 'application/json');
  };

  const exportConversation = () => {
    if (type === 'json') {
      exportJSON();
    } else if (type == 'text') {
      exportText();
    } else if (type == 'markdown') {
      exportMarkdown();
    } else if (type == 'csv') {
      exportCSV();
    } else if (type == 'screenshot') {
      exportScreenshot();
    }
  };

  return { exportConversation };
}
