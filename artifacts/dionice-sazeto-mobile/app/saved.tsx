import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSavedStories, type SavedStory } from '@/contexts/SavedStoriesContext';
import { storySentimentTone } from '@/lib/storySentiment';

function DirectionIcon({ direction, color }: { direction: SavedStory['direction']; color: string }) {
  if (direction === 'positive') return <Feather name="trending-up" size={15} color={color} />;
  if (direction === 'negative') return <Feather name="trending-down" size={15} color={color} />;
  return <Text style={[styles.directionDash, { color }]}>—</Text>;
}

function SavedStoryCard({
  story,
  onOpen,
  onRemove,
}: {
  story: SavedStory;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const sentimentTone = storySentimentTone(story);
  const accent =
    sentimentTone === 'positive'
      ? colors.positive
      : sentimentTone === 'positiveSoft'
        ? colors.positiveSoft
        : sentimentTone === 'negative'
          ? colors.destructive
          : sentimentTone === 'warning'
            ? colors.amber
            : colors.mutedForeground;
  const directionColor = accent;

  return (
    <Pressable
      onPress={onOpen}
      testID={`saved-story-${story.id}`}
      style={({ pressed }) => [
        styles.storyCard,
        pressed && styles.cardPressed,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.storyAccent, { backgroundColor: accent }]} />
      <View style={styles.storyContent}>
        <View style={styles.storyTopline}>
          <Text style={[styles.storyCompany, { color: colors.foreground }]}>
            {story.company}{story.ticker ? ` · ${story.ticker}` : ''}
          </Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            accessibilityLabel="Ukloni iz spremljenih"
            testID={`button-remove-saved-${story.id}`}
            style={({ pressed }) => [styles.bookmarkButton, pressed && styles.pressed]}
          >
            <Ionicons name="bookmark" size={18} color={colors.accent} />
          </Pressable>
        </View>
        <Text style={[styles.storyMeta, { color: colors.mutedForeground }]}>
          {story.source.toUpperCase()} · {story.published} · {story.readTime}
        </Text>
        <Text style={[styles.storyTitle, { color: colors.foreground }]}>{story.title}</Text>
        <Text numberOfLines={2} style={[styles.storySummary, { color: colors.mutedForeground }]}>
          {story.summary}
        </Text>
        <View style={styles.storyBottomline}>
          <View style={[styles.directionBadge, { backgroundColor: colors.muted }]}>
            <DirectionIcon direction={story.direction} color={directionColor} />
            <Text style={[styles.directionText, { color: directionColor }]}>{story.pressure}</Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
        </View>
      </View>
    </Pressable>
  );
}

function EmptySavedState({ isLoading }: { isLoading: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name="bookmark-outline" size={30} color={colors.mutedForeground} />
      )}
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {isLoading ? 'Učitavanje spremljenih vijesti' : 'Još nema spremljenih vijesti'}
      </Text>
      <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
        {isLoading
          ? 'Trenutak, učitavamo tvoje oznake.'
          : 'Pritisni bookmark na bilo kojoj vijesti da je pronađeš ovdje.'}
      </Text>
    </View>
  );
}

export default function SavedStoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedStories, isReady, storageError, toggleSaved } = useSavedStories();

  const openArticle = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  const removeSaved = useCallback((story: SavedStory) => {
    Haptics.selectionAsync();
    toggleSaved(story);
  }, [toggleSaved]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} testID="saved-stories-screen">
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityLabel="Natrag na pregled dana"
          accessibilityRole="button"
          onPress={() => router.back()}
          testID="button-saved-back"
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed, { borderColor: colors.primary }]}
        >
          <Feather name="arrow-left" size={18} color={colors.primary} />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Spremljeno</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {savedStories.length} spremljeno
          </Text>
        </View>
        <View style={[styles.headerBookmark, { backgroundColor: colors.secondary }]}>
          <Ionicons name="bookmark" size={18} color={colors.primary} />
        </View>
      </View>
      <FlatList
        data={savedStories}
        keyExtractor={(story) => story.id}
        showsVerticalScrollIndicator={false}
        scrollEnabled={savedStories.length > 0}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          storageError ? (
            <View style={[styles.feedback, { backgroundColor: colors.errorSurface, borderColor: colors.accent }]}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.feedbackText, { color: colors.destructive }]}>
                Spremljene vijesti se trenutno ne mogu učitati s uređaja.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <SavedStoryCard
              story={item}
              onOpen={() => openArticle(item.articleUrl)}
              onRemove={() => removeSaved(item)}
            />
          </View>
        )}
        ListEmptyComponent={<EmptySavedState isLoading={!isReady} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerButton: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitleGroup: { flex: 1, marginLeft: 14 },
  headerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 22, lineHeight: 24, letterSpacing: -0.6 },
  headerSubtitle: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, marginTop: 2 },
  headerBookmark: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  feedback: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, marginHorizontal: 20, marginBottom: 12 },
  feedbackText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 17 },
  listItem: { paddingHorizontal: 20, marginBottom: 10 },
  storyCard: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden' },
  storyAccent: { width: 5 },
  storyContent: { flex: 1, padding: 14 },
  storyTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  storyCompany: { fontFamily: 'DMSans_700Bold', fontSize: 12, flex: 1 },
  bookmarkButton: { padding: 3 },
  storyMeta: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, letterSpacing: 0.3, marginTop: 7 },
  storyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, lineHeight: 20, letterSpacing: -0.3, marginTop: 9 },
  storySummary: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 7 },
  storyBottomline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  directionBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 5, flex: 1 },
  directionText: { fontFamily: 'DMSans_500Medium', fontSize: 10, flex: 1 },
  directionDash: { fontFamily: 'DMSans_700Bold', fontSize: 17, lineHeight: 15 },
  emptyState: { paddingHorizontal: 34, paddingVertical: 56, alignItems: 'center' },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, marginTop: 12, textAlign: 'center' },
  emptyCopy: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  pressed: { opacity: 0.72 },
  cardPressed: { opacity: 0.88 },
});