# Portal de Diagnóstico CEPALSTAT - Colombia vs. América Latina y el Caribe

Este proyecto es una plataforma web interactiva diseñada en **HTML, CSS (Vanilla) y Javascript (ES6)** que consume directamente la API pública de **CEPALSTAT** para analizar y comparar indicadores demográficos, económicos, sociales y ambientales entre **Colombia** y el promedio regional de **América Latina y el Caribe (ALC)**.

---

## 🚀 Características Principales

### 1. Explorador General de Indicadores
*   **Árbol Temático Interactivo**: Carga recursivamente la estructura de categorías de CEPALSTAT.
*   **Búsqueda en Tiempo Real**: Filtra entre más de 2,000 indicadores de forma instantánea.
*   **Desagregación Dinámica**: Detecta dimensiones secundarias (Sexo, Área, etc.) y genera controles selectores automáticos en la interfaz.
*   **Análisis Histórico Heurístico**: Motor local que calcula la CAGR (Tasa de Crecimiento Anual Compuesta) y detecta brechas máximas y convergencia/divergencia estructural, **separando con rigor el registro histórico real (hasta 2024) del escenario de proyección prospectivo (2025 en adelante)**.
*   **Exportación**: Descarga directa de la tabla de datos a formato CSV.

### 2. Módulo de Estructura Demográfica (Pirámides)
*   **Sidebar de Selección**: Permite alternar entre 6 indicadores estructurales de edad y sexo clave (población quinquenal, grandes grupos, pobreza por edad/sexo, participación laboral, analfabetismo y pensiones).
*   **Visualización Sétrica Symmetrizada**:
    *   **Cantidades (`isRate: false`)**: Calcula y grafica los porcentajes de distribución relativa sobre la población total regional, mostrando los totales en el tooltip.
    *   **Tasas (`isRate: true`)**: Dibuja directamente las tasas reportadas (ej. analfabetismo) de forma simétrica.
*   **Diagnóstico Contextualizado**:
    *   Analiza dependencias y estructura demográfica clasificada en pagoda/bulbo/campana.
    *   Determina brechas de género promedio y máximas para indicadores de tasas.
    *   **Distingue claramente si los datos analizados son del Registro Real Histórico o del Escenario Proyectado**, aplicando etiquetas visuales y terminología probabilística adecuada.

---

## 🛠️ Tecnologías Utilizadas
*   **Estructura**: HTML5 semántico con metatags optimizados para SEO.
*   **Estilos**: CSS3 con variables nativas, tema oscuro premium, efectos de vidrio esmerilado (*glassmorphic cards*) y microanimaciones de transición suaves (`fadeIn`).
*   **Íconos**: FontAwesome (CDN).
*   **Gráficos**: Chart.js (CDN).
*   **Servidor local**: Python HTTP Server (iniciar.bat).

---

## 💻 Instrucciones para Ejecución Local

1.  Asegúrate de contar con **Python** instalado en tu sistema.
2.  Haz doble clic en el archivo `iniciar.bat` en la raíz de la carpeta del proyecto.
3.  El script abrirá automáticamente tu navegador predeterminado en **`http://localhost:8081`** e iniciará el servidor de desarrollo local.

---

## 📁 Estructura del Proyecto

*   `index.html`: Estructura del portal y contenedores.
*   `styles.css`: Estilos visuales del tema oscuro y adaptabilidad móvil.
*   `app.js`: Lógica de consumo de API de CEPALSTAT, generación de gráficos con Chart.js y motores de diagnóstico locales.
*   `iniciar.bat`: Script ejecutable para el servidor local.
*   `README.md`: Este manual de especificaciones.

---

## 📄 Metadatos y Diagnóstico del Quindío
Para consultar los indicadores sugeridos y correspondientes a los 22 requerimientos y problemáticas de desarrollo regional del departamento del Quindío, revisa el archivo de mapeo provisto:
*   [cepalstat_indicator_mapping.md](cepalstat_indicator_mapping.md)
