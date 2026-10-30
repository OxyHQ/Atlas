import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ResponsiveGrid } from '@oxy.so/bloom/grid';
import { Item } from '@oxy.so/bloom/item';
import { useTheme } from '@oxy.so/bloom/theme';
import { categoryIcon } from '@/components/navigation';
import type { StoreCategory } from '@/lib/store';

/**
 * The store's categories as rows: the category's glyph, its label and the
 * store's own one-line description, each a link to the category's page.
 *
 * Bloom's `ResponsiveGrid` decides the columns from its own width — one on a
 * phone, up to three on a desktop — so this has no breakpoint of its own.
 */
export function CategoryList({ categories }: { categories: readonly StoreCategory[] }) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View className="px-3">
      <ResponsiveGrid minItemWidth={300} maxColumns={3} gap={8}>
        {categories.map((category) => {
          const Glyph = categoryIcon(category.slug);
          return (
            <Item
              key={category.slug}
              accessibilityRole="link"
              leading={<Glyph width={24} height={24} fill={colors.primary} />}
              title={category.label}
              subtitle={category.description ?? undefined}
              onPress={() =>
                router.push({ pathname: '/category/[slug]', params: { slug: category.slug } })
              }
            />
          );
        })}
      </ResponsiveGrid>
    </View>
  );
}
