import { router } from 'expo-router';

import { Button } from '@/components/button';
import { ListRow, ListSection } from '@/components/list-section';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { DOCUMENT_CATEGORIES, IMAGE_CATEGORIES } from '@/constants/categories';

function openFolder(folder: string) {
  router.push({ pathname: '/files/[folder]', params: { folder } });
}

export default function FilesScreen() {
  return (
    <Screen>
      {/* Upload is wired up with expo-document-picker / expo-image-picker. */}
      <ScreenHeader title="Files" subtitle="app storage" accessory={<Button title="Upload" disabled />} />
      <ListSection label="Images" hint="vision model">
        {IMAGE_CATEGORIES.map((category) => (
          <ListRow key={category.id} title={category.name} onPress={() => openFolder(category.id)} />
        ))}
      </ListSection>
      <ListSection label="Documents" hint="by content">
        {DOCUMENT_CATEGORIES.map((category) => (
          <ListRow key={category.id} title={category.name} onPress={() => openFolder(category.id)} />
        ))}
      </ListSection>
    </Screen>
  );
}
