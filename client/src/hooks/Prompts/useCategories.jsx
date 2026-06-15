import { useLocalize } from '~/hooks';
import { CategoryIcon } from '~/components/Prompts';
import { useGetCategories } from '~/data-provider';
const loadingCategories = [
    {
        label: 'com_ui_loading',
        value: '',
    },
];
const emptyCategory = {
    label: 'com_ui_empty_category',
    value: '',
};
const useCategories = ({ className = '', hasAccess = true, }) => {
    const localize = useLocalize();
    const { data: categories = loadingCategories } = useGetCategories({
        enabled: hasAccess,
        select: (data) => data.map((category) => ({
            label: localize(category.label),
            value: category.value,
            icon: category.value ? (<CategoryIcon category={category.value} className={className}/>) : null,
        })),
    });
    return { categories, emptyCategory };
};
export default useCategories;
