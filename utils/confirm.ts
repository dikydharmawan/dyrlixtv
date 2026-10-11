import { Alert, Platform } from 'react-native';

/**
 * Konfirmasi lintas platform (native Alert + web window.confirm).
 * Mengembalikan Promise<boolean> agar mudah dipakai dengan async/await.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Hapus',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
