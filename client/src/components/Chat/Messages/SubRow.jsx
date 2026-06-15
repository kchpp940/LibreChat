import { cn } from '~/utils';
export default function SubRow({ children, classes = '', onClick }) {
    return (<div className={cn('mt-1 flex justify-start gap-3 empty:hidden lg:flex', classes)} onClick={onClick}>
      {children}
    </div>);
}
