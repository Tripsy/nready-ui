import type { DataSourceKey, DatasourceModels } from '@/types/data-source.key';
import {
	type DataSourceConfigType,
	type DataSourceSection,
	DataSourceSectionEnum,
} from '@/types/data-source.type';

const registry: Record<
	DataSourceSection,
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	Partial<Record<DataSourceKey, DataSourceConfigType<any>>>
> = {
	dashboard: {},
	public: {},
};

export async function getDataSourceConfig<
	K extends DataSourceKey,
	P extends keyof DataSourceConfigType<DatasourceModels[K]>,
>(
	section: DataSourceSection,
	key: K,
	prop: P,
): Promise<DataSourceConfigType<DatasourceModels[K]>[P]> {
	if (!registry[section]?.[key]) {
		// biome-ignore lint/suspicious/noExplicitAny: It's fine
		let defModule: { default: () => Promise<DataSourceConfigType<any>> };

		if (section === DataSourceSectionEnum.DASHBOARD) {
			defModule = await import(
				`../app/(dashboard)/dashboard/${key}/${key}.definition`
			);
		} else {
			defModule = await import(
				`../app/(public)/_components/${key}/${key}.definition`
			);
		}

		registry[section][key] = await defModule.default();
	}

	// biome-ignore lint/style/noNonNullAssertion: registry[section][key] is guaranteed to be set above
	return registry[section][key]![prop];
}
