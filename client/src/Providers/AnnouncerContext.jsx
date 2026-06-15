// AnnouncerContext.tsx
import React from 'react';
const defaultContext = {
    announceAssertive: () => console.warn('Announcement failed, LiveAnnouncer context is missing'),
    announcePolite: () => console.warn('Announcement failed, LiveAnnouncer context is missing'),
};
const AnnouncerContext = React.createContext(defaultContext);
export const useLiveAnnouncer = () => {
    const context = React.useContext(AnnouncerContext);
    return context;
};
export default AnnouncerContext;
