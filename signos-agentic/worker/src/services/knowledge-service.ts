// Knowledge RAG Service - Educational content about sign language
import { Env } from '../types';

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  confidence: number;
}

export class KnowledgeService {
  constructor(private env: Env) {}

  /**
   * Search knowledge base using RAG
   */
  async searchKnowledge(query: string): Promise<KnowledgeArticle[]> {
    try {
      // Check if Knowledge Vectorize is available
      if (!this.env.KNOWLEDGE_VECTORIZE) {
        console.warn('[KnowledgeService] Knowledge Vectorize not available');
        return this.getFallbackKnowledge(query);
      }

      // Get embedding for the query
      const embedding = await this.getEmbedding(query);
      console.log(`[KnowledgeService] Generated embedding for query: "${query}"`);
      
      // Query Knowledge Vectorize
      const results = await this.env.KNOWLEDGE_VECTORIZE.query(embedding, {
        topK: 5,
        returnValues: true,
        returnMetadata: 'all',
      });

      console.log(`[KnowledgeService] Vectorize returned ${results.matches?.length || 0} matches`);

      // Parse results
      const articles = this.parseVectorizeResults(results);
      
      // If no results from RAG, use fallback
      if (articles.length === 0) {
        console.log('[KnowledgeService] No matches found, using fallback');
        return this.getFallbackKnowledge(query);
      }

      return articles;
    } catch (error) {
      console.error('[KnowledgeService] Error searching knowledge:', error);
      return this.getFallbackKnowledge(query);
    }
  }

  /**
   * Get fallback knowledge when Vectorize is not available
   * This provides basic information until the knowledge base is populated
   */
  private getFallbackKnowledge(query: string): KnowledgeArticle[] {
    const lowerQuery = query.toLowerCase();
    
    const knowledgeBase: KnowledgeArticle[] = [
      {
        id: 'historia-lsch',
        title: 'Historia de la Lengua de Señas Chilena',
        content: `La Lengua de Señas Chilena (LSCh) es la lengua natural de la comunidad sorda en Chile. 
        
Su historia moderna comienza en 1852 con la fundación de la primera escuela para sordos en Santiago. La LSCh se ha desarrollado de forma natural dentro de la comunidad sorda chilena, incorporando elementos culturales y lingüísticos únicos del país.

En 2010, la Ley 20.422 reconoció oficialmente la LSCh como medio de comunicación de la comunidad sorda en Chile, un hito importante para los derechos de las personas sordas.

Hoy en día, se estima que más de 100,000 personas usan LSCh en Chile, entre personas sordas, sus familias, intérpretes y educadores.`,
        category: 'historia',
        confidence: 0.9,
      },
      {
        id: 'gramatica-lsch',
        title: 'Gramática de la Lengua de Señas',
        content: `La LSCh, como todas las lenguas de señas, tiene su propia gramática que difiere del español.

**Estructura básica:**
- Orden: Tiempo + Sujeto + Objeto + Verbo (diferente del español)
- No usa artículos (el, la, los, las)
- Los tiempos verbales se marcan con señas específicas al inicio
- Utiliza el espacio para establecer referentes

**Componentes de una seña:**
1. **Configuración de la mano**: Forma que toma la mano
2. **Ubicación**: Dónde se realiza la seña (en el espacio)
3. **Movimiento**: Cómo se mueve la mano
4. **Orientación**: Hacia dónde apunta la palma
5. **Expresión facial**: Componente gramatical crucial

**Ejemplo:**
En español: "Ayer fui al cine"
En LSCh: AYER YO CINE IR`,
        category: 'gramatica',
        confidence: 0.85,
      },
      {
        id: 'cultura-sorda',
        title: 'Cultura Sorda',
        content: `La cultura sorda es el conjunto de valores, normas y prácticas compartidas por la comunidad de personas sordas.

**Aspectos clave:**

**1. Identidad:** Muchas personas sordas se identifican como parte de una comunidad lingüística y cultural, no como personas con discapacidad.

**2. Lengua:** La lengua de señas es el elemento central que une a la comunidad.

**3. Valores:**
- Comunicación directa y visual
- Apreciación de la expresividad
- Sentido de pertenencia comunitaria
- Orgullo por su lengua y cultura

**4. Normas sociales:**
- Al hablar con una persona sorda, mantén contacto visual
- Toca suavemente el hombro para llamar la atención
- No interrumpas el campo visual durante una conversación
- Las despedidas pueden ser más largas (conversaciones ricas)

**5. Artes y expresión:** La comunidad sorda tiene una rica tradición en teatro, poesía en señas, humor y narrativa visual.`,
        category: 'cultura',
        confidence: 0.88,
      },
      {
        id: 'expresiones-faciales',
        title: 'Importancia de las Expresiones Faciales',
        content: `En la lengua de señas, las expresiones faciales NO son solo emocionales, son GRAMATICALES.

**Funciones:**

**1. Gramaticales:**
- **Preguntas Sí/No**: Cejas arriba
- **Preguntas WH** (qué, quién, dónde): Cejas abajo
- **Negación**: Movimiento de cabeza + expresión
- **Afirmación**: Asentir
- **Condicionales**: Cejas arriba + leve inclinación

**2. Adverbiales:**
- Intensidad (muy, mucho): Expresión intensa
- Suavidad (poco, suave): Expresión relajada
- Rapidez/lentitud: Reflejan la velocidad del movimiento

**3. Emocionales:**
- Alegría, tristeza, sorpresa (como en todas las lenguas)

**Ejemplo práctico:**
La misma seña puede significar cosas diferentes según la expresión:
- "¿Agua?" (cejas arriba) = pregunta
- "AGUA" (neutral) = afirmación
- "¡AGUA!" (cejas abajo, boca abierta) = exclamación/urgencia

**Tip:** Las expresiones faciales comienzan ANTES de la seña y duran hasta el final. Son simultáneas, no secuenciales.`,
        category: 'tecnica',
        confidence: 0.92,
      },
      {
        id: 'diferencias-lenguas-senas',
        title: 'Diferencias entre Lenguas de Señas',
        content: `Las lenguas de señas NO son universales. Cada país/región tiene su propia lengua de señas.

**Lenguas de Señas principales:**
- **LSCh**: Lengua de Señas Chilena (Chile)
- **ASL**: American Sign Language (EE.UU., Canadá anglófono)
- **LSM**: Lengua de Señas Mexicana (México)
- **LSA**: Lengua de Señas Argentina (Argentina)
- **BSL**: British Sign Language (Reino Unido)
- **ISL**: Irish Sign Language (Irlanda)
- Y más de 300 lenguas de señas en el mundo

**Diferencias:**
1. **Alfabeto manual**: Cada lengua tiene su propio dactilológico
2. **Vocabulario**: Señas diferentes para las mismas palabras
3. **Gramática**: Estructuras sintácticas propias
4. **Expresiones idiomáticas**: Únicas de cada cultura

**Ejemplo - "Madre":**
- LSCh: Mano abierta, dedos juntos, toca mejilla
- ASL: Pulgar toca barbilla, dedos extendidos
- LSM: Diferente configuración y movimiento

**Curiosidad:** Aunque ASL se usa en EE.UU., es más similar a la Lengua de Señas Francesa (LSF) que a la BSL británica, debido a su historia.`,
        category: 'linguistica',
        confidence: 0.87,
      },
      {
        id: 'aprender-lsch',
        title: 'Consejos para Aprender LSCh',
        content: `**1. Inmersión:**
- Participa en eventos de la comunidad sorda
- Busca conversaciones con señantes nativos
- Mira videos en LSCh

**2. Práctica regular:**
- 15-30 minutos diarios es mejor que sesiones largas espaciadas
- Practica frente al espejo (verifica tu expresión)
- Graba tu señado y revisa

**3. Componentes clave:**
- **Manos**: Configuración, ubicación, movimiento
- **Expresión facial**: ¡Fundamental!
- **Cuerpo**: Postura y movimientos corporales
- **Espacio**: Usa el espacio a tu alrededor

**4. No traduzcas palabra por palabra:**
- Piensa en conceptos, no en español palabra por palabra
- La gramática de LSCh es diferente al español

**5. Errores comunes a evitar:**
❌ Señar con cara neutra (las expresiones son obligatorias)
❌ Señar demasiado rápido al principio
❌ No mantener contacto visual
❌ Usar español señado (señar en orden español)

**6. Recursos:**
- Practica con esta app agéntica
- Busca cursos presenciales con profesores sordos
- Únete a comunidades en línea
- Participa en eventos de la comunidad sorda

**Recuerda:** La paciencia y el respeto por la cultura sorda son esenciales. ¡Disfruta el aprendizaje! 🤟`,
        category: 'aprendizaje',
        confidence: 0.95,
      },
      {
        id: 'dactilologia',
        title: 'Dactilología (Alfabeto Manual)',
        content: `La dactilología es el alfabeto manual usado para deletrear palabras letra por letra.

**Cuándo usar dactilología:**
- Nombres propios (personas, lugares)
- Palabras técnicas sin seña establecida
- Énfasis en una palabra específica
- Préstamos lingüísticos del español

**Cuándo NO usarla:**
❌ Para todo (no es lengua de señas, es solo una herramienta)
❌ Palabras comunes que tienen seña propia
❌ Conversación fluida (ralentiza mucho)

**Características del alfabeto LSCh:**
- Se realiza con UNA mano (monodigital)
- A la altura del hombro
- Palma generalmente hacia adelante
- Movimiento suave entre letras

**Tips para dactilología:**
1. **Claridad**: Pausa brevemente entre palabras
2. **Ritmo**: Mantén velocidad constante
3. **Movimiento**: Ligero movimiento lateral (no exagerado)
4. **Labios**: Puedes mover los labios suavemente

**Práctica:**
Empieza con tu nombre, luego nombres de ciudades, y gradualmente palabras más largas.

**Nota:** La dactilología del LSCh es diferente a la del ASL, LSM, etc. Cada lengua de señas tiene su propio alfabeto manual.`,
        category: 'tecnica',
        confidence: 0.90,
      },
    ];

    // Simple keyword matching for fallback
    if (lowerQuery.includes('historia')) {
      return [knowledgeBase[0]];
    } else if (lowerQuery.includes('gramatica') || lowerQuery.includes('gramática') || lowerQuery.includes('estructura')) {
      return [knowledgeBase[1]];
    } else if (lowerQuery.includes('cultura') || lowerQuery.includes('comunidad')) {
      return [knowledgeBase[2]];
    } else if (lowerQuery.includes('expresion') || lowerQuery.includes('expresión') || lowerQuery.includes('facial') || lowerQuery.includes('cara')) {
      return [knowledgeBase[3]];
    } else if (lowerQuery.includes('diferencia') || lowerQuery.includes('universal') || lowerQuery.includes('asl') || lowerQuery.includes('otros')) {
      return [knowledgeBase[4]];
    } else if (lowerQuery.includes('aprender') || lowerQuery.includes('consejo') || lowerQuery.includes('tip') || lowerQuery.includes('como')) {
      return [knowledgeBase[5]];
    } else if (lowerQuery.includes('dactilo') || lowerQuery.includes('alfabeto') || lowerQuery.includes('deletrear')) {
      return [knowledgeBase[6]];
    }

    // Return top 2 most relevant by default
    return knowledgeBase.slice(0, 2);
  }

  /**
   * Generate embedding for text
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response: any = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [text],
      });

      console.log('[KnowledgeService] Embedding response type:', typeof response, Array.isArray(response));

      // Workers AI returns the embeddings in different formats depending on the model
      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      } else if (Array.isArray(response) && response.length > 0) {
        return response[0];
      } else if (response && typeof response === 'object' && 'shape' in response && 'data' in response) {
        // Handle tensor format
        return response.data;
      } else {
        console.error('[KnowledgeService] Unexpected embedding response:', JSON.stringify(response).substring(0, 200));
        throw new Error('Unexpected embedding response format');
      }
    } catch (error) {
      console.error('[KnowledgeService] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Parse Vectorize results into KnowledgeArticle
   */
  private parseVectorizeResults(results: any): KnowledgeArticle[] {
    if (!results.matches || results.matches.length === 0) {
      return [];
    }

    return results.matches
      .filter((match: any) => match.metadata)
      .map((match: any) => {
        const metadata = match.metadata!;
        
        return {
          id: match.id || metadata.id || 'unknown',
          title: metadata.title || 'Sin título',
          content: metadata.content || '',
          category: metadata.category || 'general',
          confidence: match.score || 0,
        };
      });
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    return ['historia', 'gramatica', 'cultura', 'tecnica', 'linguistica', 'aprendizaje'];
  }
}

