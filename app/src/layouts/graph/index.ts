import { computed, ref, toRefs } from 'vue';
// import { defineLayout, useCollection, useItems, useSync } from '@directus/extensions-sdk';
import LayoutComponent from './layout.vue';
import OptionsComponent from './options.vue';
import { clone } from 'lodash';
import { useRelationInfo } from './useRelationInfo';
import type { CollectionOptions, LayoutOptions, LayoutQuery } from './types';
import { formatCollectionItemsCount } from './formatCollectionItemsCount';
import { syncRefProperty } from './syncRefProperty';
import { defineLayout, getFieldsFromTemplate } from '@directus/shared/utils';
import { useCollection, useItems, useSync } from '@directus/shared/composables';
import { useFieldsStore } from '@/stores/fields';
import ActionsComponent from './actions.vue';
import { AppCollection } from '@directus/shared/types';

export default defineLayout<LayoutOptions, LayoutQuery>({
	id: 'graph',
	name: 'Graph',
	icon: 'share',
	component: LayoutComponent,
	smallHeader: true,
	slots: {
		options: OptionsComponent,
		sidebar: () => null,
		actions: ActionsComponent,
	},
	setup(props, { emit }) {

		const fieldsStore = useFieldsStore()
		const selection = useSync(props, 'selection', emit);
		const layoutOptions = useSync(props, 'layoutOptions', emit);
		const layoutQuery = useSync(props, 'layoutQuery', emit);

		const running = ref(true)

		const { collection, filter, filterUser, search } = toRefs(props);

		const { info, primaryKeyField, fields: fieldsInCollection, sortField } = useCollection(collection);

		const _relationField = computed(() => layoutOptions.value?.relationField ?? null);

		const {relationInfo, relationOptions, relatedToItself, relationCollections} = useRelationInfo(collection, _relationField);

		const {relationField, collectionsOptions, baseColor, baseSize, fixedPositions, collectionsForOptions} = useLayoutOptions()

		const displayTemplates = computed(() => {
			const templates: Record<string, string> = {}

			if(!props.collection) return templates

			templates[props.collection] = title.value || info.value?.meta?.display_template || `{{${primaryKeyField.value?.field}}}`

			const relation = relationInfo.value

			if(relation === undefined) return templates

			if (relation.type === 'o2m' || relation.type === 'm2o') {
				if(relatedToItself.value) {
					templates[relation.relatedCollection.collection] = templates[props.collection]
				} else {
					templates[relation.relatedCollection.collection] = relatedTitles.value[relation.relatedCollection.collection] || relation.relatedCollection?.meta?.display_template || `{{${relation.relatedPrimaryKeyField.field}}}`
				}
				
			} else if (relation.type === 'm2m') {
				templates[relation.junctionCollection.collection] = relatedTitles.value[relation.junctionCollection.collection] || relation.junctionCollection?.meta?.display_template || `{{${relation.junctionField.field}.${relation.relatedPrimaryKeyField.field}}}`			
			
			} else if (relation.type === 'm2a') {
				for(const collection of relation.allowedCollections) {
					const primaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(collection.collection)!.field

					templates[collection.collection] = relatedTitles.value[collection.collection] || collection?.meta?.display_template || `{{${primaryKeyField}}}`
				}
			}

			return templates
		})

		const { sort, limit, page, fields, fieldsWithRelational } = useItemOptions();

		const { items, loading, error, totalPages, itemCount, totalCount, changeManualSort, getItems } = useItems(
			collection,
			{
				sort,
				limit,
				page,
				fields: fieldsWithRelational,
				filter,
				search,
			}
		);

		const showingCount = computed(() => {
			const filtering = Boolean((itemCount.value || 0) < (totalCount.value || 0) && filterUser.value);
			return formatCollectionItemsCount(itemCount.value || 0, page.value, limit.value, filtering);
		});

		return {
			items,
			loading,
			error,
			totalPages,
			page,
			toPage,
			itemCount,
			totalCount,
			fieldsInCollection,
			fields,
			limit,
			primaryKeyField,
			info,
			showingCount,
			sortField,
			changeManualSort,
			refresh,
			resetPresetAndRefresh,
			selectAll,
			filter,
			search,
			layoutOptions,
			relationField,
			relationInfo,
			displayTemplates,
			relatedToItself,
			running,
			collectionsOptions,
			baseColor,
			baseSize,
			fixedPositions,
			relationOptions,
			collectionsForOptions
		};

		async function resetPresetAndRefresh() {
			await props?.resetPreset?.();
			refresh();
		}

		function refresh() {
			getItems();
		}

		function toPage(newPage: number) {
			page.value = newPage;
		}

		function selectAll() {
			if (!primaryKeyField.value) return;
			const pk = primaryKeyField.value;
			selection.value = clone(items.value).map((item) => item[pk.field]);
		}

		function useItemOptions() {
			const page = syncRefProperty(layoutQuery, 'page', 1);
			const limit = syncRefProperty(layoutQuery, 'limit', -1);
			const defaultSort = computed(() => (primaryKeyField.value ? [primaryKeyField.value?.field] : []));
			const sort = syncRefProperty(layoutQuery, 'sort', defaultSort);
			const fields = syncRefProperty(layoutQuery, 'fields', defaultSort);

			const fieldsWithRelational = computed<string[]>(() => {
				if (!props.collection || !relationField.value) return [];

				const displayFields: Set<string> = new Set(fields.value)
				const relation = relationInfo.value

				getFieldsFromTemplate(displayTemplates.value[props.collection]).forEach(field => displayFields.add(field))

				if(relation?.type === undefined) return Array.from(displayFields)

				if (relation.type === 'o2m' || relation.type === 'm2o') {
					displayFields.add(`${relationField.value}.${relation.relatedPrimaryKeyField.field}`)
					getFieldsFromTemplate(displayTemplates.value[relation.relatedCollection.collection]).forEach(field => displayFields.add(`${relationField.value}.${field}`))

				} else if (relation.type === 'm2m') {
					displayFields.add(`${relationField.value}.${relation.junctionField.field}.${relation.relatedPrimaryKeyField.field}`)
					getFieldsFromTemplate(displayTemplates.value[relation.junctionCollection.collection]).forEach(field => displayFields.add(`${relationField.value}.${field}`))

				} else if (relation.type === 'm2a') {
					for(const collection of relation.allowedCollections) {
						displayFields.add(`${relationField.value}.${relation.collectionField.field}`)
						displayFields.add(`${relationField.value}.${relation.junctionField.field}.${fieldsStore.getPrimaryKeyFieldForCollection(collection.collection)!.field}`)
						getFieldsFromTemplate(displayTemplates.value[collection.collection]).forEach(field => displayFields.add(`${relationField.value}.${relation.junctionField.field}.${field}`))
					}
				}

				return Array.from(displayFields);
			});

			return { sort, limit, page, fields, fieldsWithRelational };
		}

		function useLayoutOptions() {
			const relationField = createViewOption<string | null>('relationField', relationOptions.value[0]?.value ?? null);
			const fixedPositions = createViewOption<boolean>('fixedPositions', false);
			const baseColor = createViewOption<string>('baseColor', '#000000');
			const baseSize = createViewOption<number>('baseSize', 10);

			const collectionsForOptions = computed(() => [...relationCollections.value, info.value] as AppCollection[])

			const collectionsOptions = computed({
				get() {
					return Object.fromEntries(collectionsForOptions.value.map(collection => {
						const existingValue = layoutOptions.value.collectionsOptions?.[collection.collection] ?? {}

						return [collection.collection, existingValue]
					}))
				}, set(newOptions) {
					layoutOptions.value = {
						...layoutOptions.value,
						collectionsOptions: newOptions,
					};
				}
			})

			return { relationField, collectionsOptions, baseColor, baseSize, fixedPositions, collectionsForOptions };

			function createViewOption<T>(key: keyof LayoutOptions, defaultValue: any) {
				return computed<T>({
					get() {
						return layoutOptions.value?.[key] !== undefined ? layoutOptions.value?.[key] : defaultValue;
					},
					set(newValue: T) {
						layoutOptions.value = {
							...layoutOptions.value,
							[key]: newValue,
						};
					},
				});
			}
		}
	},
});
