import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.brand}>Jarvis</Text>
      <Text style={styles.subtitle}>ecossistema · E3 scaffold</Text>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => {
          // PR 2 vai ligar isso ao orchestrator
          console.log('[jarvis] press-to-talk placeholder');
        }}
      >
        <Text style={styles.buttonText}>Falar com Claudinho</Text>
      </Pressable>

      <Text style={styles.footer}>PR 1 · scaffold Expo · sem backend ainda</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    color: '#E6F1FF',
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#64FFDA',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 48,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  button: {
    backgroundColor: '#1E88E5',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 999,
    shadowColor: '#1E88E5',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonPressed: {
    backgroundColor: '#1565C0',
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    color: '#5F7A99',
    fontSize: 12,
    marginTop: 64,
  },
});
