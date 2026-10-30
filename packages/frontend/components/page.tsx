import { useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { PageHeader } from '@oxy.so/bloom/page-header';
import { Screen, ScreenScrollView } from '@oxy.so/bloom/screen';
import { TitleAccount } from '@/components/navigation';

/**
 * Every Atlas route is one Bloom `Screen`: it owns the one scroller (the
 * document on web, the route's own scroller on native), the header's placement
 * and the clearance under the shell's bars. These two wrappers only decide what
 * goes in its header.
 */

interface PageProps {
  title: string;
  /** A line under the large title. */
  subtitle?: string;
  /** Content beside the large title, before the account (an action). */
  titleAccessory?: ReactNode;
  children: ReactNode;
}

/**
 * A top-level page (Discover, Categories, Search, a category): a large title in
 * the content that hands over to the header's small title as it scrolls away —
 * Bloom's "reveal after an in-content heading" composition. The account sits at
 * the title's trailing edge while the shell's navigation is a drawer.
 *
 * The heading's measured height is the reveal offset; it is measured, not
 * assumed, because a subtitle, a larger system font or a narrow screen
 * wrapping the title all move it.
 */
export function TopLevelPage({ title, subtitle, titleAccessory, children }: PageProps) {
  const [headingHeight, setHeadingHeight] = useState(0);

  const onHeadingLayout = (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setHeadingHeight((current) => (current === height ? current : height));
  };

  return (
    <Screen scroll="auto" header={<PageHeader title={title} titleRevealOffset={headingHeight} />}>
      <ScreenScrollView contentContainerClassName="pb-12">
        <View onLayout={onHeadingLayout} className="flex-row items-end gap-3 px-5 pb-2 pt-1">
          <View className="min-w-0 flex-1">
            <Text
              role="heading"
              aria-level={1}
              className="text-[34px] font-bold leading-[41px] tracking-[-0.4px] text-foreground"
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-[15px] leading-5 text-muted-foreground" numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {titleAccessory}
          <TitleAccount />
        </View>
        {children}
      </ScreenScrollView>
    </Screen>
  );
}

/**
 * A page pushed over the top-level ones (an app, Settings): the header carries
 * the title and Bloom's route Back, which `BloomProvider back` supplies.
 */
export function DetailPage({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Screen scroll="auto" header={<PageHeader title={title} />}>
      <ScreenScrollView contentContainerClassName="pb-12">{children}</ScreenScrollView>
    </Screen>
  );
}
