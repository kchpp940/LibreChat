import useRum from './useRum';
export default function WithRum({ children }) {
    useRum();
    return <>{children}</>;
}
