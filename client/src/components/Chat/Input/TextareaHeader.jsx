import { memo } from 'react';
import AddedConvo from './AddedConvo';
export default memo(function TextareaHeader({ addedConvo, setAddedConvo, }) {
    if (!addedConvo) {
        return null;
    }
    return (<div className="m-1.5 flex flex-col divide-y overflow-hidden rounded-b-lg rounded-t-2xl bg-surface-secondary-alt">
      <AddedConvo addedConvo={addedConvo} setAddedConvo={setAddedConvo}/>
    </div>);
});
