import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGetStartupConfig } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { normalizeRumPath } from './routes';
const PROXY_API_KEY = 'librechat-rum-proxy';
let rumProxyToken;
let rumProxyFetchPatched = false;
function shouldInitializeRum(config, token) {
    if (!config?.enabled || config.provider !== 'hyperdx' || !config.url || !config.serviceName) {
        return false;
    }
    if (config.authMode === 'publicToken') {
        return !!config.publicToken;
    }
    return config.authMode === 'proxy' && !!token && !config.publicToken;
}
function getApiKey(config, token) {
    if (config.authMode === 'proxy') {
        return token ? PROXY_API_KEY : '';
    }
    return config.publicToken ?? '';
}
function isRumProxyRequest(input, proxyUrl) {
    const rawUrl = typeof Request !== 'undefined' && input instanceof Request ? input.url : input.toString();
    const url = new URL(rawUrl, window.location.origin);
    const proxy = new URL(proxyUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith(`${proxy.pathname}/`);
}
function withAuthorization(input, init, token) {
    const headers = new Headers(init?.headers ??
        (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
    headers.set('authorization', `Bearer ${token}`);
    if (typeof Request !== 'undefined' && input instanceof Request) {
        return [new Request(input, { ...init, headers }), undefined];
    }
    return [input, { ...init, headers }];
}
function ensureRumProxyAuth(proxyUrl) {
    if (rumProxyFetchPatched || typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return;
    }
    const originalFetch = window.fetch.bind(window);
    const patchedFetch = (input, init) => {
        if (rumProxyToken && isRumProxyRequest(input, proxyUrl)) {
            const [authorizedInput, authorizedInit] = withAuthorization(input, init, rumProxyToken);
            return originalFetch(authorizedInput, authorizedInit);
        }
        return originalFetch(input, init);
    };
    window.fetch = Object.assign(patchedFetch, { preconnect: window.fetch.preconnect });
    rumProxyFetchPatched = true;
}
function buildGlobalAttributes(user, config, route) {
    return Object.fromEntries(Object.entries({
        route,
        role: user?.role,
        userId: user?.id,
        orgId: user?.tenantId,
        serviceName: config.serviceName,
        environment: config.environment,
    }).filter((entry) => typeof entry[1] === 'string' && entry[1] !== ''));
}
async function loadHyperDX() {
    const module = await import('@hyperdx/browser');
    return module.default;
}
export default function useRum() {
    const { data: startupConfig } = useGetStartupConfig();
    const { token, user } = useAuthContext();
    const location = useLocation();
    const initializedKeyRef = useRef(undefined);
    const sampledInitKeyRef = useRef(undefined);
    const sampledInRef = useRef(true);
    const hyperDxRef = useRef(undefined);
    const rumConfig = startupConfig?.rum;
    const route = useMemo(() => normalizeRumPath(location.pathname), [location.pathname]);
    const routeRef = useRef(route);
    useEffect(() => {
        routeRef.current = route;
    }, [route]);
    useEffect(() => {
        if (!rumConfig) {
            return;
        }
        if (!shouldInitializeRum(rumConfig, token)) {
            if (rumConfig?.authMode === 'proxy') {
                rumProxyToken = undefined;
            }
            return;
        }
        const config = rumConfig;
        const apiKey = getApiKey(config, token);
        if (config.authMode === 'proxy') {
            rumProxyToken = token;
            ensureRumProxyAuth(config.url);
        }
        const initKey = [config.url, config.serviceName, config.authMode, apiKey].join(':');
        if (initializedKeyRef.current === initKey) {
            return;
        }
        if (sampledInitKeyRef.current !== initKey) {
            sampledInitKeyRef.current = initKey;
            sampledInRef.current =
                typeof config.sampleRate === 'number' ? Math.random() < config.sampleRate : true;
        }
        if (!sampledInRef.current) {
            return;
        }
        let cancelled = false;
        loadHyperDX()
            .then((HyperDX) => {
            if (cancelled || initializedKeyRef.current === initKey) {
                return;
            }
            HyperDX.init({
                advancedNetworkCapture: config.advancedNetworkCapture ?? false,
                apiKey,
                consoleCapture: config.consoleCapture ?? false,
                disableReplay: config.disableReplay ?? true,
                service: config.serviceName,
                tracePropagationTargets: config.tracePropagationTargets,
                url: config.url,
            });
            hyperDxRef.current = HyperDX;
            initializedKeyRef.current = initKey;
            HyperDX.setGlobalAttributes(buildGlobalAttributes(user, config, routeRef.current));
        })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [rumConfig, token, user]);
    useEffect(() => {
        hyperDxRef.current?.setGlobalAttributes(rumConfig ? buildGlobalAttributes(user, rumConfig, route) : { route });
    }, [route, rumConfig, user]);
}
