import React, { useState } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

interface Props {
  urls: string[];
  placeholderUri?: string;
  recyclingKey: string;
  style: StyleProp<ViewStyle>;
  isDark: boolean;
  retryKey: string;
}

export function BreedImageView({ urls, placeholderUri, recyclingKey, style, isDark, retryKey }: Props) {
  const [failure, setFailure] = useState<{ key: string; urls: string[] }>({ key: retryKey, urls: [] });
  const failedUrls = failure.key === retryKey ? failure.urls : [];
  const uri = urls.find((url) => url.length > 0 && !failedUrls.includes(url));
  return (
    <View style={[style, styles.container, { backgroundColor: isDark ? '#0F172A' : '#E2E8F0' }]}>
      {uri ? (
        <Image
          key={uri}
          source={{ uri }}
          placeholder={placeholderUri && !failedUrls.includes(placeholderUri) ? { uri: placeholderUri } : undefined}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={recyclingKey}
          onError={() => setFailure((previous) => ({
            key: retryKey,
            urls: [...(previous.key === retryKey ? previous.urls : []), uri],
          }))}
        />
      ) : (
        <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#475569' }}>
          Image unavailable
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});