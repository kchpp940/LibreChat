import { matchPath } from 'react-router-dom';
const matchesRouteStart = (pathname, pattern) => matchPath({ path: pattern, end: false }, pathname) != null;
export const isArtifactRoute = (pathname) => matchesRouteStart(pathname, '/c/*') || matchesRouteStart(pathname, '/share/*');
