import React from 'react';
import AnnouncerContext from '~/Providers/AnnouncerContext';
const LiveMessenger = ({ children }) => (<AnnouncerContext.Consumer>{(contextProps) => children(contextProps)}</AnnouncerContext.Consumer>);
export default LiveMessenger;
