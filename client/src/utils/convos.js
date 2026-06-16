import { LocalStorageKeys } from 'librechat-data-provider';
import { conversationCacheService } from '~/data-provider';
import { format, isToday, subDays, getYear, parseISO, startOfDay, startOfYear, isWithinInterval, } from 'date-fns';
// Date group helpers
export const dateKeys = {
    today: 'com_ui_date_today',
    yesterday: 'com_ui_date_yesterday',
    previous7Days: 'com_ui_date_previous_7_days',
    previous30Days: 'com_ui_date_previous_30_days',
    january: 'com_ui_date_january',
    february: 'com_ui_date_february',
    march: 'com_ui_date_march',
    april: 'com_ui_date_april',
    may: 'com_ui_date_may',
    june: 'com_ui_date_june',
    july: 'com_ui_date_july',
    august: 'com_ui_date_august',
    september: 'com_ui_date_september',
    october: 'com_ui_date_october',
    november: 'com_ui_date_november',
    december: 'com_ui_date_december',
};
const getGroupName = (date) => {
    const now = new Date(Date.now());
    if (isToday(date)) {
        return dateKeys.today;
    }
    if (isWithinInterval(date, { start: startOfDay(subDays(now, 1)), end: now })) {
        return dateKeys.yesterday;
    }
    if (isWithinInterval(date, { start: subDays(now, 7), end: now })) {
        return dateKeys.previous7Days;
    }
    if (isWithinInterval(date, { start: subDays(now, 30), end: now })) {
        return dateKeys.previous30Days;
    }
    if (isWithinInterval(date, { start: startOfYear(now), end: now })) {
        const month = format(date, 'MMMM').toLowerCase();
        return dateKeys[month];
    }
    return ' ' + getYear(date).toString();
};
const monthOrderMap = new Map([
    ['december', 11],
    ['november', 10],
    ['october', 9],
    ['september', 8],
    ['august', 7],
    ['july', 6],
    ['june', 5],
    ['may', 4],
    ['april', 3],
    ['march', 2],
    ['february', 1],
    ['january', 0],
]);
const dateKeysReverse = Object.fromEntries(Object.entries(dateKeys).map(([k, v]) => [v, k]));
const dateGroupsSet = new Set([
    dateKeys.today,
    dateKeys.yesterday,
    dateKeys.previous7Days,
    dateKeys.previous30Days,
]);
export const groupConversationsByDate = (conversations, dateField = 'updatedAt') => {
    if (!Array.isArray(conversations)) {
        return [];
    }
    const seenConversationIds = new Set();
    const groups = new Map();
    const now = new Date(Date.now());
    conversations.forEach((conversation) => {
        if (!conversation || seenConversationIds.has(conversation.conversationId)) {
            return;
        }
        seenConversationIds.add(conversation.conversationId);
        let date;
        const dateValue = conversation[dateField] ?? conversation.updatedAt ?? conversation.createdAt;
        if (dateValue) {
            date = parseISO(dateValue);
        }
        else {
            date = now;
        }
        const groupName = getGroupName(date);
        if (!groups.has(groupName)) {
            groups.set(groupName, []);
        }
        groups.get(groupName).push(conversation);
    });
    const sortedGroups = new Map();
    dateGroupsSet.forEach((group) => {
        if (groups.has(group)) {
            sortedGroups.set(group, groups.get(group));
        }
    });
    const yearMonthGroups = Array.from(groups.keys())
        .filter((group) => !dateGroupsSet.has(group))
        .sort((a, b) => {
        const [yearA, yearB] = [parseInt(a.trim()), parseInt(b.trim())];
        if (yearA !== yearB) {
            return yearB - yearA;
        }
        const [monthA, monthB] = [dateKeysReverse[a], dateKeysReverse[b]];
        const bOrder = monthOrderMap.get(monthB) ?? -1, aOrder = monthOrderMap.get(monthA) ?? -1;
        return bOrder - aOrder;
    });
    yearMonthGroups.forEach((group) => {
        sortedGroups.set(group, groups.get(group));
    });
    sortedGroups.forEach((conversations) => {
        conversations.sort((a, b) => new Date(b[dateField] ?? b.updatedAt ?? 0).getTime() -
            new Date(a[dateField] ?? a.updatedAt ?? 0).getTime());
    });
    return Array.from(sortedGroups, ([key, value]) => [key, value]);
};
function getConversationQueryProjectId(queryKey) {
    const params = queryKey[1];
    if (!params || typeof params !== 'object') {
        return undefined;
    }
    return params.projectId;
}
function conversationMatchesProjectQuery(queryKey, conversation) {
    const projectId = getConversationQueryProjectId(queryKey);
    if (!projectId) {
        return true;
    }
    if (projectId === 'unassigned') {
        return !conversation.chatProjectId;
    }
    return conversation.chatProjectId === projectId;
}
/**
 * Reads the project id from the current URL's `?projectId` param — the source of
 * truth for a new chat's project scope (the conversation atom can lag behind it).
 */
export function getRouteChatProjectId() {
    if (typeof window === 'undefined') {
        return null;
    }
    const projectId = new URLSearchParams(window.location.search).get('projectId');
    return projectId != null && /^[a-f\d]{24}$/i.test(projectId) ? projectId : null;
}
// === InfiniteData helpers for cursor-based convo queries ===
export function findConversationInInfinite(data, conversationId) {
    if (!data) {
        return undefined;
    }
    for (const page of data.pages) {
        const found = page.conversations.find((c) => c.conversationId === conversationId);
        if (found) {
            return found;
        }
    }
    return undefined;
}
export function updateInfiniteConvoPage(data, conversationId, updater) {
    if (!data) {
        return data;
    }
    return {
        ...data,
        pages: data.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((c) => c.conversationId === conversationId ? updater(c) : c),
        })),
    };
}
export function addConversationToInfinitePages(data, newConversation) {
    if (!data) {
        return {
            pageParams: [undefined],
            pages: [{ conversations: [newConversation], nextCursor: null }],
        };
    }
    return {
        ...data,
        pages: [
            { ...data.pages[0], conversations: [newConversation, ...data.pages[0].conversations] },
            ...data.pages.slice(1),
        ],
    };
}
export function addConversationToAllConversationsQueries(queryClient, newConversation) {
    conversationCacheService.addConversationToAllQueries(queryClient, newConversation);
}
export function removeConvoFromInfinitePages(data, conversationId) {
    if (!data) {
        return data;
    }
    return {
        ...data,
        pages: data.pages
            .map((page) => ({
            ...page,
            conversations: page.conversations.filter((c) => c.conversationId !== conversationId),
        }))
            .filter((page) => page.conversations.length > 0),
    };
}
// Used for partial update (e.g., title, etc.), updating AND possibly bumping to front of visible convos
export function updateConvoFieldsInfinite(data, updatedConversation, keepPosition = false) {
    if (!data) {
        return data;
    }
    let found;
    let pageIdx = -1, convoIdx = -1;
    for (let i = 0; i < data.pages.length; ++i) {
        const idx = data.pages[i].conversations.findIndex((c) => c.conversationId === updatedConversation.conversationId);
        if (idx !== -1) {
            pageIdx = i;
            convoIdx = idx;
            found = data.pages[i].conversations[idx];
            break;
        }
    }
    if (!found) {
        return data;
    }
    if (keepPosition) {
        return {
            ...data,
            pages: data.pages.map((page, pi) => pi === pageIdx
                ? {
                    ...page,
                    conversations: page.conversations.map((c, ci) => ci === convoIdx ? { ...c, ...updatedConversation } : c),
                }
                : page),
        };
    }
    else {
        const patched = { ...found, ...updatedConversation, updatedAt: new Date().toISOString() };
        const pages = data.pages.map((page) => ({
            ...page,
            conversations: page.conversations.filter((c) => c.conversationId !== patched.conversationId),
        }));
        pages[0].conversations = [patched, ...pages[0].conversations];
        const finalPages = pages.filter((page) => page.conversations.length > 0);
        return { ...data, pages: finalPages };
    }
}
export function storeEndpointSettings(conversation) {
    if (!conversation) {
        return;
    }
    const { endpoint, model } = conversation;
    if (!endpoint) {
        return;
    }
    const lastModel = JSON.parse(localStorage.getItem(LocalStorageKeys.LAST_MODEL) ?? '{}');
    lastModel[endpoint] = model;
    localStorage.setItem(LocalStorageKeys.LAST_MODEL, JSON.stringify(lastModel));
}
// Add
export function addConvoToAllQueries(queryClient, newConvo) {
    conversationCacheService.addConversation(queryClient, newConvo);
}
export function upsertConvoInAllQueries(queryClient, nextConvo, moveToTop = true) {
    conversationCacheService.upsertConversation(queryClient, nextConvo, moveToTop);
}
// Update
export function updateConvoInAllQueries(queryClient, conversationId, updater, moveToTop = false) {
    conversationCacheService.updateConversationInAllQueries(queryClient, conversationId, updater, moveToTop);
}
// Remove
export function removeConvoFromAllQueries(queryClient, conversationId) {
    conversationCacheService.removeConversationFromAllQueries(queryClient, conversationId);
}
