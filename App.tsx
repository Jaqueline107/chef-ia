import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

const GROQ_APIKEY = process.env.EXPO_PUBLIC_GROQ_APIKEY;

export default function App() {
  const [ingredientes, setIngredientes] = useState('');
  const [receita, setReceita] = useState('');
  const [loading, setLoading] = useState(false);
  const [appReady, setAppReady] = useState(false);

  const [modoCozinha, setModoCozinha] = useState(false);
  const [passos, setPassos] = useState<string[]>([]);
  const [passoAtual, setPassoAtual] = useState(0);
  const [vozAtiva, setVozAtiva] = useState(true);
  const podeEntrarModoCozinha = !loading && passos.length > 0;

  const tempoPasso = 6;

  const api = axios.create({
    baseURL: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_APIKEY}`
    }
  });

 useEffect(() => {
  const backAction = () => {
    if (modoCozinha) {
      setModoCozinha(false);
      setPassoAtual(0);
      setPassos([]);
      return true; // ❗ impede fechar o app
    }
    return false; // deixa o Android sair normalmente da tela/app
  };

  const subscription = BackHandler.addEventListener(
    'hardwareBackPress',
    backAction
  );

  return () => subscription.remove();
}, [modoCozinha]);

  useEffect(() => {
    setTimeout(() => setAppReady(true), 1500);
  }, []);

  function extrairPassos(texto: string) {
    const regex = /\d+\.\s(.+)/g;
    return [...texto.matchAll(regex)].map(i => i[1]);
  }

function falarSiri(texto: string) {
  Speech.stop();

  // quebra frases para parecer humano
  const frases = texto
    .replace(/,/g, ', ...')
    .replace(/\./g, '. ...')
    .split('...');

  let i = 0;

  const falarProxima = () => {
    if (i >= frases.length) return;

    const frase = frases[i].trim();

    Speech.speak(frase, {
      language: 'pt-BR',
      rate: 0.88,
      pitch: 1.12,
      onDone: () => {
        i++;
        setTimeout(falarProxima, 250); // pausa estilo humano
      },
    });
  };

  falarProxima();
}

  async function gerarReceita() {
    setLoading(true);

    try {
      const resposta = await api.post('', {
        model: "llama-3.1-8b-instant",
        max_tokens: 1024,
        temperature: 1,
        messages: [
          {
            role: "system",
            content: `
        Você é um personal chef de cozinha criativo, carismático e especialista em ajudar pessoas criando receitas deliciosas com base nos ingredientes fornecidos.

        Sua missão é gerar receitas com uma apresentação BONITA, MODERNA e ENVOLVENTE, proporcionando uma experiência divertida e agradável para o usuário.

        REGRAS IMPORTANTES:
        - Sempre use emojis relacionados ao prato.
        - O nome do prato deve conter um emoji correspondente à receita.
        - Organize a resposta de forma visualmente bonita.
        - Use linguagem amigável e apetitosa.
        - As instruções devem ser claras e fáceis de seguir.
        - Faça o usuário sentir vontade de cozinhar.
        - Nunca use markdown com **.
        - Use espaçamento entre as seções.

        FORMATO OBRIGATÓRIO DA RESPOSTA:

        🍽️ NOME DO PRATO:
        [Emoji + Nome criativo da receita]

        🛒 INGREDIENTES:
        • Ingrediente 1
        • Ingrediente 2
        • Ingrediente 3

        👨‍🍳 MODO DE PREPARO:
        1. Passo 1
        2. Passo 2
        3. Passo 3

        ✨ SUGESTÕES DE APRESENTAÇÃO:
        • Sugestão 1
        • Sugestão 2
        • Sugestão 3

        💡 DICA DO CHEF:
        [Uma dica útil, criativa ou saborosa sobre o prato]

        REGRAS EXTRAS:
        - Se a receita for doce, use emojis fofos e divertidos.
        - Se for fitness, use emojis saudáveis.
        - Se for bebida, use emojis de copos/frutas.
        - Se for comida brasileira, deixe o texto mais acolhedor.
        - Crie nomes criativos para as receitas.
        - A resposta deve parecer de um aplicativo premium de culinária.
        `
          },
        ]
      });

      let texto = resposta.data.choices[0].message.content;
      texto = texto.replace(/\*\*/g, '');

      setReceita(texto);

      let buffer = '';
      for (let i = 0; i < texto.length; i++) {
        buffer += texto[i];
        setReceita(buffer);
        await new Promise(r => setTimeout(r, 8));
      }

      const passosExtraidos = extrairPassos(texto);
      setPassos(passosExtraidos);
      setPassoAtual(0);

    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  // 🔊 VOZ
  useEffect(() => {
    if (modoCozinha && vozAtiva && passos[passoAtual]) {
      Speech.stop();
      falarSiri(passos[passoAtual]);
    }
  }, [passoAtual]);

  // ⏱ AUTO NEXT
  useEffect(() => {
  if (!modoCozinha || !vozAtiva) return;
  if (!passos[passoAtual]) return;

  Speech.stop();

  // fala o passo atual
  Speech.speak(passos[passoAtual], {
    language: 'pt-BR',
    rate: 1,
    onDone: () => {
      // 🔥 quando terminar de falar → vai pro próximo
      setPassoAtual(prev => {
        if (prev < passos.length - 1) return prev + 1;

        setModoCozinha(false);
        return prev;
      });
    },
  });

  return () => {
    Speech.stop();
  };
}, [passoAtual, modoCozinha, vozAtiva]);

  if (!appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0f1a' }}>
        <Image
          source={require('./assets/chef-splash.png')}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
        />
      </View>
    );
  }

  // 🍳 MODO COZINHA
  if (modoCozinha) {
    const passo = passos[passoAtual] || '';

    return (
      <View style={styles.cozinhaContainer}>

        <Text style={styles.cozinhaTitulo}>
          🍳 {passoAtual + 1} / {passos.length || 1}
        </Text>

        <View style={styles.progressBar}>
          <View
            style={{
              width: `${passos.length ? ((passoAtual + 1) / passos.length) * 100 : 0}%`,
              height: 6,
              backgroundColor: '#48C748',
            }}
          />
        </View>

        <Text style={styles.cozinhaPasso}>{passo}</Text>

        <TouchableOpacity onPress={() => setVozAtiva(!vozAtiva)}>
          <Text style={{ color: '#48C748', marginBottom: 20 }}>
            {vozAtiva ? "🔊 Voz ON" : "🔇 Voz OFF"}
          </Text>
        </TouchableOpacity>

        <View style={styles.cozinhaBotoes}>

          {/* ⬅ VOLTAR PRA HOME (CORRIGIDO) */}
          <TouchableOpacity
            onPress={() => {
              setModoCozinha(false);
              setPassoAtual(0);
              setPassos([]);
            }}
          >
            <Text style={styles.navBtn}>⬅️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (passoAtual < passos.length - 1) {
                setPassoAtual(passoAtual + 1);
              } else {
                setModoCozinha(false);
              }
            }}
          >
            <Text style={styles.navBtn}>
              {passoAtual === passos.length - 1 ? "🏁" : "➡️"}
            </Text>
          </TouchableOpacity>

        </View>

      </View>
    );
  }

  // 🌙 HOME (SEU DESIGN ORIGINAL MANTIDO)
  return (
    <LinearGradient colors={['#0b0f1a', '#070d2a', '#0d092e']} style={{ flex: 1 }}>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>

          <View style={styles.container}>

            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
              <Text style={styles.emoji}>👩‍🍳</Text>
              <Text style={styles.title}>Chef IA By Jaqueline Moura</Text>
              <Text style={styles.subtitle}>
                Digite os ingredientes que você tem e receba receitas personalizadas!
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Ex: arroz, frango..."
              placeholderTextColor="#888"
              value={ingredientes}
              onChangeText={setIngredientes}
              multiline
            />

            <TouchableOpacity
                style={[
                  styles.button,
                  loading && { opacity: 0.5 }
                ]}
                onPress={gerarReceita}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Gerando..." : "Gerar Receita"}
                </Text>
            </TouchableOpacity>

            {receita ? (
              <>
                <ScrollView style={styles.receitaContainer}>
                  <Text style={styles.receita}>{receita}</Text>
                </ScrollView>

              <TouchableOpacity
                disabled={!podeEntrarModoCozinha}
                style={[
                  styles.modoButton,
                  (!podeEntrarModoCozinha || loading) && { opacity: 0.4 }
                ]}
                onPress={() => {
                  setModoCozinha(true);
                  setPassoAtual(0);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  🍳 Modo Cozinha
                </Text>
              </TouchableOpacity>
              </>
            ) : (
              <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 50 }}>
                Nenhuma receita ainda
              </Text>
            )}

          </View>

        </ScrollView>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },

  // 🧑‍🍳 HEADER (voltou como você queria)
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },

  emoji: {
    fontSize: 60,
    marginBottom: 10,
  },

  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  subtitle: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },

  // 🧾 INPUT
  input: {
    backgroundColor: '#2d2d44',
    color: '#fff',
    padding: 15,
    borderRadius: 12,
    minHeight: 58,
    marginTop: 20,
  },

  // 🍳 BOTÃO PRINCIPAL
  button: {
    backgroundColor: '#48C748',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },

  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // 📜 RECEITA
  receitaContainer: {
    marginTop: 20,
    backgroundColor: '#2d2d44',
    padding: 15,
    borderRadius: 12,
    maxHeight: 260,
  },

  receita: {
    color: '#fff',
    lineHeight: 22,
  },

  // 🍳 BOTÃO MODO COZINHA
  modoButton: {
    marginTop: 12,
    backgroundColor: '#ff7b00',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },

  // 💤 PLACEHOLDER
  placeholder: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 50,
  },

  // 🍳 MODO COZINHA
  cozinhaContainer: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  cozinhaTitulo: {
    color: '#aaa',
    fontSize: 18,
    marginBottom: 15,
  },

  cozinhaPasso: {
    color: '#fff',
    fontSize: 26,
    textAlign: 'center',
    marginVertical: 30,
    paddingHorizontal: 10,
  },

  // 📊 PROGRESS BAR
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#222',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 25,
  },

  // ⬅️➡️ BOTÕES
  cozinhaBotoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
    marginTop: 20,
  },

  navBtn: {
    color: '#48C748',
    fontSize: 34,
    marginHorizontal: 25,
  },

});