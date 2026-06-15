import BookmarkEmptyState from './BookmarkEmptyState';
import BookmarkCard from './BookmarkCard';
import { useLocalize } from '~/hooks';
export default function BookmarkList({ bookmarks, moveRow, isFiltered = false, }) {
    const localize = useLocalize();
    if (bookmarks.length === 0) {
        return <BookmarkEmptyState isFiltered={isFiltered}/>;
    }
    return (<div className="space-y-2" role="list" aria-label={localize('com_ui_bookmarks')}>
      {bookmarks.map((bookmark) => (<div key={bookmark._id} role="listitem">
          <BookmarkCard bookmark={bookmark} position={bookmark.position} moveRow={moveRow}/>
        </div>))}
    </div>);
}
