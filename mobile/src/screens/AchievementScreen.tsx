import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import { cssInterop } from 'nativewind';
import { useAuth } from '../auth/AuthContext';
import { Art, Button, DetailHeader, Empty, Icon, LoadError, Loading, ModeBanner, Notice, Screen, SectionTitle } from '../components/ui';
import { dateLabel, errorMessage, useLoad } from '../lib/data';
import { AchievementMedia, RootStackParams } from '../lib/types';

cssInterop(VideoView, { className: 'style' });
const StyledVideoView = VideoView as React.ComponentType<React.ComponentProps<typeof VideoView> & { className?: string }>;

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <StyledVideoView player={player} nativeControls fullscreenOptions={{ enable: true }} contentFit="contain" className="h-full w-full" />;
}

interface UploadTicket { media: AchievementMedia; uploadUrl: string; headers: Record<string, string> }

export default function AchievementScreen({ route, navigation }: NativeStackScreenProps<RootStackParams, 'Achievement'>) {
  const { achievement, gameName, appId } = route.params;
  const { api, mode, apiBase, user } = useAuth();
  const [revealed, setRevealed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<AchievementMedia | null>(null);
  const state = useLoad(`${mode}:${user?.steamId}:${apiBase}:media:${appId}:${achievement.apiName}`, () => api.get<AchievementMedia[]>(`/media/${encodeURIComponent(achievement.apiName)}?appId=${appId}`), mode === 'signed-in');
  const hidden = achievement.hidden && !achievement.achieved && !revealed;
  async function upload() {
    setOperationError(null); setSuccess(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsEditing: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      if (state.data?.some(item => item.type === type)) throw new Error(`This achievement already has a ${type === 'video' ? 'video' : 'photo'}. Delete it first to save a different one.`);
      const info = await FileSystem.getInfoAsync(asset.uri);
      const sizeBytes = asset.fileSize ?? (info.exists && 'size' in info ? info.size : 0);
      const maxSize = (type === 'video' ? 100 : 50) * 1024 * 1024;
      if (!sizeBytes) throw new Error('Could not read this file. Please choose another photo or video.');
      if (sizeBytes > maxSize) throw new Error(`Choose a ${type === 'video' ? 'video under 100 MB' : 'photo under 50 MB'}.`);
      const extension = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
      const contentType = asset.mimeType ?? mimeTypes[extension ?? ''] ?? '';
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(contentType)) throw new Error('Choose a JPEG, PNG, GIF, WebP, MP4, WebM, or MOV file.');
      setUploading(true);
      const ticket = await api.post<UploadTicket>(`/media/upload-url/${encodeURIComponent(achievement.apiName)}`, { appId, type, fileName: asset.fileName ?? `achievement-${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`, contentType, sizeBytes });
      const response = await FileSystem.uploadAsync(ticket.uploadUrl, asset.uri, { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: ticket.headers });
      if (response.status < 200 || response.status >= 300) throw new Error(`Upload failed (${response.status}). Please try again.`);
      await api.post<AchievementMedia>(`/media/complete/${encodeURIComponent(ticket.media.id)}`, {});
      setSuccess('Your moment has been saved.');
      await state.reload();
    } catch (error) { setOperationError(errorMessage(error)); }
    finally { setUploading(false); }
  }
  function remove(item: AchievementMedia) {
    Alert.alert('Delete this moment?', 'This removes the uploaded file from this achievement.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      setRemoving(true); setOperationError(null); setSuccess(null);
      try { await api.delete(`/media/${encodeURIComponent(item.id)}`); setSelected(null); setSuccess('Moment deleted.'); await state.reload(); }
      catch (error) { setOperationError(errorMessage(error)); setSelected(null); }
      finally { setRemoving(false); }
    })(); } }]);
  }
  return <Screen bottom><DetailHeader title="Achievement" goBack={() => navigation.goBack()} /><ScrollView className="flex-1"><View className="mx-auto w-full max-w-3xl p-5 pb-10">
    <ModeBanner /><Text className="mb-4 text-sm font-medium text-steam-accent">{gameName}</Text>
    <View className="flex-row items-start gap-4"><Art uri={hidden ? undefined : achievement.achieved ? achievement.icon : achievement.iconGray} icon={achievement.achieved ? 'trophy-outline' : 'lock-closed-outline'} className="h-20 w-20" /><View className="flex-1"><Text accessibilityRole="header" className="text-2xl font-bold text-white">{hidden ? 'Hidden achievement' : achievement.displayName}</Text><View className="mt-3 flex-row items-center gap-2"><Icon name={achievement.achieved ? 'checkmark-circle' : 'lock-closed-outline'} size={18} color={achievement.achieved ? '#66c0f4' : '#9aafbf'} /><Text className="text-base text-steam-text">{achievement.achieved ? 'Unlocked' : 'Locked'}</Text></View></View></View>
    <Text className="mb-5 mt-5 text-base leading-7 text-steam-text">{hidden ? 'This achievement is hidden. Reveal its description if you would like a hint.' : achievement.description || 'No description available.'}</Text>
    {hidden ? <Button secondary icon="eye-outline" onPress={() => setRevealed(true)}>Reveal achievement</Button> : null}
    <View className="mt-3 gap-2 border-y border-steam-border py-4">
      {achievement.achieved ? <Text className="text-sm text-steam-muted">Unlocked {dateLabel(achievement.unlockTime)}</Text> : null}
      {achievement.globalPercent !== null ? <Text className="text-sm text-steam-muted">{achievement.globalPercent.toFixed(1)}% of Steam players earned this</Text> : null}
      {achievement.points !== undefined ? <Text className="text-sm text-steam-muted">{achievement.points} points{achievement.hardcore ? ' · Earned in hardcore mode' : ''}</Text> : null}
      {!achievement.achieved && achievement.globalPercent === null && achievement.points === undefined ? <Text className="text-sm text-steam-muted">Ready for your next challenge.</Text> : null}
    </View>
    <SectionTitle>Your moments</SectionTitle>
    <Text className="mb-4 text-base leading-6 text-steam-muted">Keep a photo or video of the unlock alongside your achievement.</Text>
    {mode !== 'signed-in' ? <Notice>{mode === 'demo' ? 'Sign in with Steam to save photos and videos to your real achievements.' : 'Public previews are read-only. Sign in with Steam to view and save your own moments.'}</Notice> : <>
      {operationError ? <Notice error>{operationError}</Notice> : null}{success ? <Notice>{success}</Notice> : null}
      {achievement.achieved ? <><Button icon="add-outline" onPress={() => void upload()} busy={uploading} disabled={removing || state.loading || !!state.error || !!(state.data?.some(item => item.type === 'image') && state.data?.some(item => item.type === 'video'))}>{uploading ? 'Uploading your moment…' : 'Add photo or video'}</Button><Text className="mt-2 text-xs leading-5 text-steam-muted">One photo (up to 50 MB) and one video (up to 100 MB) per achievement. Delete a saved moment to replace it.</Text></> : <Notice>Unlock this achievement before adding a photo or video.</Notice>}
      {state.loading ? <Loading label="Loading your moments…" /> : null}{state.error ? <LoadError message={state.error} onRetry={() => void state.reload()} /> : null}
      {!state.loading && !state.error && !state.data?.length ? <Empty title="No moments saved yet" description={achievement.achieved ? 'Choose a photo or video to remember this achievement.' : 'Your saved moments will appear here.'} icon="images-outline" /> : null}
      {state.data?.map(item => <View key={item.id} className="mt-5 overflow-hidden rounded-xl bg-steam-navy"><Pressable accessibilityRole="button" accessibilityLabel={`View ${item.type === 'video' ? 'video' : 'photo'} ${item.filename ?? ''}`} onPress={() => setSelected(item)} className="active:opacity-70">
        <Art uri={item.type === 'image' ? item.url : item.thumbnailUrl} icon={item.type === 'video' ? 'play-circle-outline' : 'image-outline'} className="aspect-video w-full" />
        <View className="flex-row items-center gap-2 px-4 py-3"><Icon name={item.type === 'video' ? 'videocam-outline' : 'image-outline'} size={18} /><Text numberOfLines={1} className="flex-1 text-sm text-steam-text">{item.caption || item.filename || (item.type === 'video' ? 'Achievement video' : 'Achievement photo')}</Text><Icon name="expand-outline" size={18} /></View>
      </Pressable></View>)}
    </>}
  </View></ScrollView>
    <Modal visible={!!selected} animationType="fade" onRequestClose={() => setSelected(null)} presentationStyle="fullScreen"><SafeAreaView className="flex-1 bg-steam-dark">
      <View className="flex-row items-center justify-between px-4 py-2"><Text numberOfLines={1} className="flex-1 text-lg font-semibold text-white">{selected?.type === 'video' ? 'Your video' : 'Your photo'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close viewer" onPress={() => setSelected(null)} className="min-h-12 min-w-12 items-center justify-center"><Icon name="close" size={28} /></Pressable></View>
      <View className="flex-1">{selected ? selected.type === 'image' ? <Image accessibilityLabel={selected.caption || 'Saved achievement photo'} source={{ uri: selected.url }} resizeMode="contain" className="h-full w-full" /> : <VideoPlayer uri={selected.url} /> : null}</View>
      <View className="gap-3 p-5"><Text className="text-sm text-steam-text">{selected?.caption || selected?.filename || achievement.displayName}</Text><Button danger busy={removing} disabled={uploading} icon="trash-outline" onPress={() => { if (selected) remove(selected); }}>Delete moment</Button></View>
    </SafeAreaView></Modal>
  </Screen>;
}
