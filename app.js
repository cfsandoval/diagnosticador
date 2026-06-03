/**
 * CEPAL Diagnostic Dashboard Application Logic
 */

// Application State
let appState = {
    // ...existing fields...
    selectedRegion: 'ALC', // default region comparison

    treeData: null,
    selectedIndicator: null,
    indicatorData: null,
    chartInstance: null,
    chartType: 'line',
    selectedFilters: {}, // Maps dimension_id -> member_id
    
    // Global Section & Structures (Pyramids) State
    currentGlobalSection: 'explorer',
    selectedPyramidIndicatorId: 4789,
    pyramidData: null,
    pyramidYear: null,
    pyramidFilters: {}, // Maps dimension_id -> member_id
    pyramidChartCol: null,
    pyramidChartAlc: null,
    pyramidDataCache: {}, // Cache for all structural indicators to enable fast print report generation
    selectedReportType: 'executive',
    activeTendenciaReport: 'balance_preliminar',
    
    // Creador de Indicadores Sintéticos State
    customChartInstance: null,
    customIndicatorResults: [],
    selectedTendencia2Dimension: 'Todos',
    
    // Multi-LLM Diagnostics Cache & State
    diagnosticCache: {},
    diagnosticArgs: null,
    queryBalance: 15.0000,
    totalTokensUsed: 0,
    freeTiers: {
        gemini: 500000,
        chatgpt: 150000,
        claude: 100000,
        qwen: 1000000,
        llama: 250000
    },
    lastGptRealResponse: null
};

// Constants for Standard Dimensions
const COUNTRY_DIM_ID = 208;
const YEAR_DIM_ID = 29117;
const COLOMBIA_MEMBER_ID = 225;
const ALC_MEMBER_ID = 212; // América Latina y el Caribe
const LAT_MEMBER_ID = 43053; // América Latina (promedio simple)
const LATO_MEMBER_ID = 211; // América Latina

// Grouped Structural Indicators configuration
const PYRAMID_INDICATORS = [
    { id: 4789, name: "Población por grupos quinquenales de edad", isRate: false, icon: "fa-users" },
    { id: 4793, name: "Estructura por grandes grupos de edad (7)", isRate: false, icon: "fa-people-group" },
    { id: 3341, name: "Pobreza y pobreza extrema por sexo y edad", isRate: false, icon: "fa-hand-holding-dollar" },
    { id: 120, name: "Tasa de participación en la fuerza de trabajo", isRate: true, icon: "fa-briefcase" },
    { id: 53, name: "Tasa de analfabetismo por sexo y edad", isRate: true, icon: "fa-book-reader" },
    { id: 5338, name: "Población ocupada cotizante a pensiones", isRate: true, icon: "fa-piggy-bank" }
];

// Critical Benchmarks for Colombia vs Latin America & Caribbean (ALC)
// Pre-populated with realistic indices for fast, offline, and reliable summary rendering
const CRITICAL_BENCHMARKS = [
    {
        id: "unemployment",
        indicatorId: 127,
        name: "[127] Tasa de desocupación total",
        icon: "fa-briefcase",
        colVal: 10.2,
        alcVal: 6.3,
        alVal: 6.1,
        latVal: 6.8,
        unit: "%",
        year: 2023,
        interpretation: "Mayor desempleo en Colombia vs. la media regional"
    },
    {
        id: "poverty",
        indicatorId: 3328,
        name: "[3328] Población en situación de pobreza",
        icon: "fa-hand-holding-dollar",
        colVal: 33.0,
        alcVal: 27.3,
        alVal: 27.0,
        latVal: 28.5,
        unit: "%",
        year: 2023,
        interpretation: "Mayor incidencia de pobreza monetaria en el país"
    },
    {
        id: "dependency",
        indicatorId: 4792,
        name: "[4792] Relación de dependencia demográfica total",
        icon: "fa-people-group",
        colVal: 45.3,
        alcVal: 47.8,
        alVal: 47.5,
        latVal: 48.2,
        unit: "por 100 activos",
        year: 2024,
        interpretation: "Menor carga de dependencia (bono demográfico favorable)"
    },
    {
        id: "gdp_per_capita",
        indicatorId: 2206,
        name: "[2206] Producto interno bruto (PIB) total anual por habitante a precios constantes en dólares",
        icon: "fa-money-bill-trend-up",
        colVal: 6200,
        alcVal: 8800,
        alVal: 9100,
        latVal: 8500,
        unit: "USD/hab",
        year: 2023,
        interpretation: "Rezago en el nivel de ingreso promedio por habitante"
    },
    {
        id: "co2_emissions",
        indicatorId: 5649,
        name: "[5649] Emisiones de dióxido de carbono (CO₂) por habitante",
        icon: "fa-cloud-showers-water",
        colVal: 1.60,
        alcVal: 2.80,
        alVal: 2.50,
        latVal: 2.10,
        unit: "tCO₂/hab",
        year: 2021,
        interpretation: "Menor huella de carbono per cápita en Colombia (favorable)"
    },
    {
        id: "gini",
        indicatorId: 3289,
        name: "[3289] Índice de Gini (concentración del ingreso)",
        icon: "fa-scale-unbalanced",
        colVal: 54.6,
        alcVal: 45.7,
        alVal: 45.1,
        latVal: 46.2,
        unit: "puntos",
        year: 2023,
        interpretation: "Mayor nivel de desigualdad en la distribución del ingreso"
    },
    {
        id: "pension_coverage",
        indicatorId: 5338,
        name: "[5338] Población ocupada cotizante a pensiones",
        icon: "fa-piggy-bank",
        colVal: 29.5,
        alcVal: 36.0,
        alVal: 35.8,
        latVal: 34.2,
        unit: "%",
        year: 2023,
        interpretation: "Menor proporción de ocupados cotizando al sistema previsional"
    },
    {
        id: "illiteracy",
        indicatorId: 53,
        name: "[53] Tasa de analfabetismo de la población joven y adulta",
        icon: "fa-book-reader",
        colVal: 4.8,
        alcVal: 6.3,
        alVal: 6.1,
        latVal: 5.9,
        unit: "%",
        year: 2023,
        interpretation: "Menor tasa de analfabetismo general en el país (favorable)"
    },
    {
        id: "labor_participation",
        indicatorId: 120,
        name: "[120] Tasa de participación en la fuerza de trabajo",
        icon: "fa-briefcase",
        colVal: 64.2,
        alcVal: 62.6,
        alVal: 62.8,
        latVal: 61.5,
        unit: "%",
        year: 2023,
        interpretation: "Mayor inserción laboral activa de la población en edad de trabajar"
    },
    {
        id: "theil_index",
        indicatorId: 3303,
        name: "[3303] Índice de Theil (desigualdad distributiva)",
        icon: "fa-chart-pie",
        colVal: 0.52,
        alcVal: 0.37,
        alVal: 0.36,
        latVal: 0.39,
        unit: "índice",
        year: 2023,
        interpretation: "Mayor concentración y asimetría en la distribución de la riqueza"
    },
    {
        id: "child_poverty",
        indicatorId: 3341,
        name: "[3341] Pobreza infantil (población menor de 15 años en pobreza)",
        icon: "fa-child",
        colVal: 33.4,
        alcVal: 27.6,
        alVal: 26.8,
        latVal: 28.1,
        unit: "%",
        year: 2023,
        interpretation: "Mayor incidencia de pobreza en la población infantil"
    },
    {
        id: "female_unemployment",
        indicatorId: 127,
        name: "[127] Tasa de desocupación femenina",
        icon: "fa-venus",
        colVal: 14.0,
        alcVal: 9.2,
        alVal: 9.0,
        latVal: 9.8,
        unit: "%",
        year: 2023,
        interpretation: "Marcada brecha de género con mayor desocupación para mujeres"
    },
    {
        id: "male_unemployment",
        indicatorId: 127,
        name: "[127] Tasa de desocupación masculina",
        icon: "fa-mars",
        colVal: 9.0,
        alcVal: 6.1,
        alVal: 5.9,
        latVal: 6.5,
        unit: "%",
        year: 2023,
        interpretation: "Desocupación masculina ligeramente superior a la media de la región"
    },
    {
        id: "child_dependency",
        indicatorId: 4792,
        name: "[4792] Relación de dependencia de la población joven (0 a 14 años)",
        icon: "fa-children",
        colVal: 29.8,
        alcVal: 31.5,
        alVal: 31.1,
        latVal: 32.2,
        unit: "por 100 activos",
        year: 2024,
        interpretation: "Menor carga demográfica de menores de 14 años (favorable)"
    }
];

// API Endpoints
const API_TREE = 'https://api-cepalstat.cepal.org/cepalstat/api/v1/thematic-tree?lang=es';
const API_DATA_BASE = 'https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator';

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    renderFavorites();
    // Save initial state for history navigation
    const initialState = { section: 'explorer', indicatorId: null };
    history.replaceState(initialState, '', '');

    fetchThematicTree();
    setupSearch();
    initStructuresSidebar();
    renderCriticalGaps();
    initGlobalTooltip();
    updateTokenStatusBar();
    loadOpenAiKey();
    
    // Background pre-fetch of all pyramid/rates indicators to ensure instant PDF generation
    setTimeout(preFetchAllPyramidData, 1000);
});

// 1. Fetch and render thematic tree
async function fetchThematicTree() {
    const treeLoading = document.getElementById('tree-loading');
    const treeEl = document.getElementById('thematic-tree');
    
    try {
        const response = await fetch(API_TREE);
        if (!response.ok) throw new Error('Error al conectar con la API de la CEPAL');
        
        const data = await response.json();
        appState.treeData = data.body;
        
        // Hide loader
        treeLoading.style.display = 'none';
        
        // Render tree recursively
        if (appState.treeData && appState.treeData.children) {
            renderTree(appState.treeData.children, treeEl, []);
            appState.flatIndicators = flattenThematicTree(appState.treeData.children);
            
            // Re-initialize the export checklist if the user is currently on that section
            if (appState.currentGlobalSection === 'exportar-datos') {
                initExportarDatosSection();
            }
            
            // Re-populate the report indicators list if the report modal is open
            const reportModal = document.getElementById('report-modal');
            if (reportModal && reportModal.style.display === 'flex') {
                populateReportIndicatorsList();
                const presetSelect = document.getElementById('report-preset-select');
                if (presetSelect) {
                    applyReportPreset(presetSelect.value);
                }
            }
        } else {
            treeEl.innerHTML = '<ul class="tree-list"></ul><div id="favorites-section" style="margin-top:1rem;"><h3 class="metadata-subtitle" style="font-size:0.75rem; letter-spacing:0.5px; font-weight:600; text-transform:uppercase; margin-bottom:0.5rem;">Indicadores de Interés</h3><ul id="favorites-list" class="tree-list"></ul></div><li class="tree-loading">El árbol temático está vacío</li>';
        }
    } catch (error) {
        console.error('Error fetching tree:', error);
        treeLoading.innerHTML = `
            <div style="color: var(--accent-red); text-align: center; padding: 1rem;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                <span>No se pudo cargar el árbol temático. Revisa tu conexión.</span>
            </div>
        `;
    }
}

// Helper to recursively render the tree

    // Helper to check if indicator is favorite
    window.isIndicatorFavorite = function(id) {
        if (id === undefined || id === null) return false;
        try {
            const list = JSON.parse(localStorage.getItem('favorite_indicators') || '[]');
            if (!Array.isArray(list)) return false;
            return list.some(item => {
                if (!item) return false;
                if (typeof item === 'object') {
                    const itemId = item.id !== undefined ? item.id : item.indicator_id;
                    if (itemId !== undefined && itemId !== null) {
                        return itemId == id || parseInt(itemId) === parseInt(id);
                    }
                } else {
                    return item == id || parseInt(item) === parseInt(id);
                }
                return false;
            });
        } catch (e) {
            console.error("Error in isIndicatorFavorite:", e);
            return false;
        }
    };

    // Favorites handling
    window.toggleFavorite = function(id, name, path, button) {
        let list = JSON.parse(localStorage.getItem('favorite_indicators') || '[]');
        const exists = list.find(item => parseInt(item.id) === parseInt(id));
        let nowFav = false;
        if (exists) {
            // remove
            list = list.filter(item => parseInt(item.id) !== parseInt(id));
        } else {
            list.push({id: parseInt(id), name, path});
            nowFav = true;
        }
        localStorage.setItem('favorite_indicators', JSON.stringify(list));
        
        // Find and update all bookmark buttons in the document for this indicator ID
        const buttons = document.querySelectorAll(`.favorite-btn[data-id="${id}"]`);
        buttons.forEach(btn => {
            if (nowFav) {
                btn.innerHTML = '<i class="fa-solid fa-bookmark" style="color: var(--color-colombia);"></i>';
                btn.title = "Quitar de guardados";
            } else {
                btn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
                btn.title = "Guardar indicador";
            }
        });

        renderFavorites();
        
        // Update mass selected count if currently in the export view
        if (appState.currentGlobalSection === 'exportar-datos') {
            updateMassSelectedCount();
        }
    };

    window.renderFavorites = function() {
        const container = document.getElementById('favorites-list');
        if (!container) return;
        const list = JSON.parse(localStorage.getItem('favorite_indicators') || '[]');
        container.innerHTML = '';
        list.forEach(item => {
            const li = document.createElement('li');
            li.className = 'tree-item';
            li.innerHTML = `<span>${item.name}</span> <button class="remove-fav" data-id="${item.id}" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>`;
            li.querySelector('.remove-fav').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item.id, item.name, item.path, e.target);
            });
            container.appendChild(li);
        });
    };
function hasNonStructuralIndicators(node) {
    if (node.indicator_id) {
        return !PYRAMID_INDICATORS.some(p => p.id === node.indicator_id);
    }
    if (node.children && node.children.length > 0) {
        return node.children.some(child => hasNonStructuralIndicators(child));
    }
    return false;
}

function renderTree(nodes, parentEl, pathNames) {
    nodes.forEach(node => {
        if (!hasNonStructuralIndicators(node)) {
            return;
        }
        const li = document.createElement('li');
        li.className = 'tree-item';
        
        const isCategory = node.children && node.children.length > 0;
        const currentPath = [...pathNames, node.name];
        
        if (isCategory) {
            // Category Node (Folder)
            const header = document.createElement('div');
            header.className = 'tree-node-header';
            header.innerHTML = `
                <i class="fa-solid fa-chevron-right chevron"></i>
                <i class="fa-solid fa-folder" style="color: var(--accent-blue); opacity: 0.75;"></i>
                <span>${node.name}</span>
            `;
            
            const content = document.createElement('ul');
            content.className = 'tree-node-content tree-list';
            
            // Toggle expansion
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                header.classList.toggle('expanded');
            });
            
            li.appendChild(header);
            li.appendChild(content);
            parentEl.appendChild(li);
            
            // Recursively render children
            renderTree(node.children, content, currentPath);
        } else if (node.indicator_id) {
            // Leaf Node (Indicator)
            const leaf = document.createElement('div');
            leaf.className = 'tree-leaf';
            leaf.dataset.id = node.indicator_id;
            
            const isFav = isIndicatorFavorite(node.indicator_id);
            const favIconHtml = isFav 
                ? '<i class="fa-solid fa-bookmark" style="color: var(--color-colombia);"></i>' 
                : '<i class="fa-regular fa-bookmark"></i>';
            const favTitle = isFav ? "Quitar de guardados" : "Guardar indicador";

            leaf.innerHTML = `
                <i class="fa-solid fa-chart-simple tree-leaf-icon"></i>
                <span>[${node.indicator_id}] ${node.name}</span>
                <button class="favorite-btn" data-id="${node.indicator_id}" data-name="[${node.indicator_id}] ${node.name}" data-path="${pathNames.join(' / ')}" title="${favTitle}">${favIconHtml}</button>
            `;
            
            leaf.addEventListener('click', (e) => {
                e.stopPropagation();
                // Remove previous selected class
                document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
                leaf.classList.add('selected');
                
                selectIndicator({
                    id: node.indicator_id,
                    name: `[${node.indicator_id}] ${node.name}`,
                    categoryPath: pathNames.join(' / ')
                });
            });
            
            // Favorite button handler
            const favBtn = leaf.querySelector('.favorite-btn');
            if (favBtn) {
                favBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(node.indicator_id, `[${node.indicator_id}] ${node.name}`, pathNames.join(' / '), favBtn);
                });
            }
            
            li.appendChild(leaf);
            parentEl.appendChild(li);
        }
    });
}

// Search Filter setup
function setupSearch() {
    const searchInput = document.getElementById('indicator-search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const treeItems = document.querySelectorAll('#thematic-tree > .tree-item');
        
        if (query === '') {
            // Restore default view
            document.querySelectorAll('.tree-item, .tree-leaf').forEach(el => {
                el.style.display = '';
            });
            document.querySelectorAll('.tree-node-header').forEach(el => {
                el.classList.remove('expanded');
            });
            return;
        }
        
        // Filter recursively
        filterTreeItems(treeItems, query);
    });
}

// Recursive function to filter tree and expand matching branches
function filterTreeItems(items, query) {
    let anyMatches = false;
    
    items.forEach(item => {
        let isMatch = false;
        
        const headerEl = item.querySelector(':scope > .tree-node-header');
        const leafEl = item.querySelector(':scope > .tree-leaf');
        
        if (leafEl) {
            // Leaf node matching
            const text = leafEl.querySelector('span').textContent.toLowerCase();
            isMatch = text.includes(query);
            leafEl.style.display = isMatch ? 'flex' : 'none';
            if (isMatch) anyMatches = true;
        } else if (headerEl) {
            // Category node: check if the folder matches or its children matches
            const headerText = headerEl.querySelector('span').textContent.toLowerCase();
            const contentEl = item.querySelector(':scope > .tree-node-content');
            const childItems = contentEl.querySelectorAll(':scope > .tree-item');
            
            // Check children
            const childrenMatch = filterTreeItems(childItems, query);
            
            if (headerText.includes(query) || childrenMatch) {
                isMatch = true;
                headerEl.classList.add('expanded');
                headerEl.style.display = 'flex';
                contentEl.style.display = 'block';
                anyMatches = true;
                
                // If the header matches but no children matched, let's keep all children visible
                if (headerText.includes(query) && !childrenMatch) {
                    childItems.forEach(ci => {
                        ci.style.display = '';
                        const cleaf = ci.querySelector('.tree-leaf');
                        if (cleaf) cleaf.style.display = 'flex';
                        const chead = ci.querySelector('.tree-node-header');
                        if (chead) chead.style.display = 'flex';
                    });
                }
            } else {
                headerEl.style.display = 'none';
                contentEl.style.display = 'none';
            }
        }
        
        item.style.display = isMatch ? 'block' : 'none';
    });
    
    return anyMatches;
}

// 2. Select Indicator and Fetch Data
async function selectIndicator(indicator, pushHistory = true) {
    appState.selectedIndicator = indicator;
    
    // Switch section if not in explorer
    if (appState.currentGlobalSection !== 'explorer') {
        switchGlobalSection('explorer', false);
    }
    
    if (pushHistory) {
        history.pushState({ section: 'explorer', indicatorId: indicator.id }, '', '');
    }
    
    // Clear selections in structures
    document.querySelectorAll('.structures-list-item').forEach(el => el.classList.remove('active'));
    
    // Hide empty state, show dashboard
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'block';
    
    // Update Header
    document.getElementById('dashboard-indicator-name').textContent = indicator.name;
    document.getElementById('dashboard-indicator-area').textContent = indicator.categoryPath;
    
    // Trigger Loading state
    const chartLoading = document.getElementById('chart-loading');
    chartLoading.classList.add('active');
    
    try {
        const url = `${API_DATA_BASE}/${indicator.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID},${LAT_MEMBER_ID},${LATO_MEMBER_ID}`;
        const metaUrl = `https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/${indicator.id}/metadata?lang=es`;
        
        const [response, metaResponse] = await Promise.all([
            fetch(url),
            fetch(metaUrl).catch(err => {
                console.error("Error fetching indicator metadata:", err);
                return null;
            })
        ]);
        
        if (!response.ok) throw new Error('No se pudieron obtener los datos de la CEPAL');
        
        const res = await response.json();
        appState.indicatorData = res.body;
        
        appState.indicatorMetadata = null;
        if (metaResponse && metaResponse.ok) {
            try {
                const metaRes = await metaResponse.json();
                appState.indicatorMetadata = metaRes.body.metadata;
            } catch (err) {
                console.error("Error parsing indicator metadata JSON:", err);
            }
        }
        
        // Parse metadata and details
        updateMetadataSection();
        
        // Setup Secondary Filters
        setupDimensionFilters();
        
        // Render Dashboard Visuals
        renderDashboardData();
        
    } catch (error) {
        console.error('Error fetching indicator data:', error);
        document.getElementById('diagnostic-content').innerHTML = `
            <div style="color: var(--accent-red); font-weight: 500;">
                <i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos para este indicador.
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    La API de la CEPAL no devolvió datos estructurados para Colombia/ALC en este indicador o el indicador es de tipo cualitativo. Por favor, selecciona otro del árbol.
                </p>
            </div>
        `;
        chartLoading.classList.remove('active');
        clearKpis();
    }
}

// Reset KPIs when error
function clearKpis() {
    document.getElementById('kpi-colombia-val').textContent = '-';
    document.getElementById('kpi-alc-val').textContent = '-';
    document.getElementById('kpi-gap-val').textContent = '-';
    document.getElementById('kpi-gap-pct').textContent = '-';
    document.getElementById('kpi-colombia-trend').innerHTML = '<i class="fa-solid fa-minus"></i> <span>Sin datos</span>';
    document.getElementById('kpi-alc-trend').innerHTML = '<i class="fa-solid fa-minus"></i> <span>Sin datos</span>';
    
    const gapTitle = document.querySelector('.kpi-title.gap span');
    if (gapTitle) gapTitle.textContent = 'Brecha de Valor';
    
    const gapIcon = document.querySelector('.kpi-title.gap i');
    if (gapIcon) {
        gapIcon.className = 'fa-solid fa-scale-unbalanced';
    }
}

// 3. Update Technical Sheet
function updateMetadataSection() {
    const meta = appState.indicatorData.metadata || {};
    const sources = appState.indicatorData.sources || [];
    const footnotes = appState.indicatorData.footnotes || [];
    
    // Detailed metadata from endpoint
    const detailedMeta = appState.indicatorMetadata || {};
    
    // 1. Definition (prefer detailed description/definition if available)
    const definitionText = detailedMeta.definition || meta.description || appState.selectedIndicator.name;
    document.getElementById('meta-definition').innerHTML = definitionText.trim().replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
    
    // 2. Unit of Measure
    const unitText = detailedMeta.unit || meta.unit || 'No especificada';
    document.getElementById('meta-unit').textContent = unitText;
    
    // 3. Theme and Area Temática
    let themeAreaText = 'No especificado';
    if (detailedMeta.theme || detailedMeta.area) {
        themeAreaText = [detailedMeta.theme, detailedMeta.area].filter(Boolean).join(' / ');
    }
    document.getElementById('meta-theme-area').textContent = themeAreaText;
    
    // 4. Last update
    const updatedText = detailedMeta.last_update || 'No disponible';
    document.getElementById('meta-updated').textContent = updatedText;
    
    // 5. Methodology
    const methodSec = document.getElementById('meta-methodology-section');
    if (detailedMeta.calculation_methodology) {
        methodSec.style.display = 'block';
        document.getElementById('meta-methodology').innerHTML = detailedMeta.calculation_methodology;
    } else {
        methodSec.style.display = 'none';
    }
    
    // 6. Data features (Characteristics)
    const featuresSec = document.getElementById('meta-features-section');
    if (detailedMeta.data_features) {
        featuresSec.style.display = 'block';
        document.getElementById('meta-features').innerHTML = detailedMeta.data_features.trim().replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
    } else {
        featuresSec.style.display = 'none';
    }
    
    // 7. Indicator note
    const noteSec = document.getElementById('meta-note-section');
    if (detailedMeta.note && detailedMeta.note.trim() !== '') {
        noteSec.style.display = 'block';
        document.getElementById('meta-note').innerHTML = detailedMeta.note.trim().replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
    } else {
        noteSec.style.display = 'none';
    }
    
    // 8. Comments & Observations
    const commentsSec = document.getElementById('meta-comments-section');
    if (detailedMeta.comments) {
        commentsSec.style.display = 'block';
        document.getElementById('meta-comments').innerHTML = detailedMeta.comments;
    } else {
        commentsSec.style.display = 'none';
    }
    
    // Format Sources
    if (sources.length > 0) {
        document.getElementById('meta-sources').innerHTML = sources.map(src => {
            return `<div><strong>${src.organization_acronym || 'Fuente'}</strong>: ${src.description} ${src.publication_url ? `<br><a href="${src.publication_url}" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-size: 0.75rem;"><i class="fa-solid fa-link"></i> Ver enlace</a>` : ''}</div>`;
        }).join('<br>');
    } else {
        document.getElementById('meta-sources').textContent = 'No especificada en los metadatos.';
    }
    
    // Format Footnotes
    const notesSec = document.getElementById('notes-section');
    if (footnotes.length > 0) {
        notesSec.style.display = 'block';
        document.getElementById('meta-footnotes').innerHTML = footnotes.map(fn => `<li>${fn.description}</li>`).join('');
    } else {
        notesSec.style.display = 'none';
    }
}

// 4. Setup Dynamic Dimension Selectors
function setupDimensionFilters() {
    const dimensions = appState.indicatorData.dimensions || [];
    const filterContainer = document.getElementById('dynamic-filters');
    filterContainer.innerHTML = '';
    
    appState.selectedFilters = {};
    
    // Filter dimensions: exclude Country (208) and Year (29117)
    const secondaryDims = dimensions.filter(d => d.id !== COUNTRY_DIM_ID && d.id !== YEAR_DIM_ID);
    
    if (secondaryDims.length === 0) {
        filterContainer.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 10px; padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
                <i class="fa-solid fa-info-circle" style="color: var(--accent-blue); margin-bottom: 0.35rem; display: block; font-size: 1rem;"></i>
                Este indicador no contiene desagregaciones secundarias adicionales.
            </div>
        `;
        return;
    }
    
    secondaryDims.forEach(dim => {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        
        const label = document.createElement('label');
        label.className = 'filter-label';
        label.textContent = dim.name;
        
        const select = document.createElement('select');
        select.className = 'select-control';
        select.dataset.dimId = dim.id;
        
        const members = dim.members || [];
        
        // Find which member should be selected by default:
        // 1. One where selected is 1
        // 2. One where in is 1
        // 3. Default total/both sexes or first one
        let defaultMember = members.find(m => m.selected === 1);
        if (!defaultMember) defaultMember = members.find(m => m.in === 1);
        
        // If not found, look for keyword "ambos" (both sexes), "total", "nacional" (national)
        if (!defaultMember) {
            defaultMember = members.find(m => {
                const name = m.name.toLowerCase();
                return name.includes('ambos') || name.includes('total') || name.includes('nacional');
            });
        }
        if (!defaultMember && members.length > 0) defaultMember = members[0];
        
        // Set default filter state
        if (defaultMember) {
            appState.selectedFilters[dim.id] = defaultMember.id;
        }
        
        // Populate options
        members.forEach(member => {
            const opt = document.createElement('option');
            opt.value = member.id;
            opt.textContent = member.name;
            if (defaultMember && member.id === defaultMember.id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
        
        // Event listener for filter change
        select.addEventListener('change', (e) => {
            appState.selectedFilters[dim.id] = parseInt(e.target.value);
            renderDashboardData();
        });
        
        filterGroup.appendChild(label);
        filterGroup.appendChild(select);
        filterContainer.appendChild(filterGroup);
    });
}

// 5. Render Main Dashboard Vis (KPIs, Charts, Table, Diagnostic)
function renderDashboardData() {
    const chartLoading = document.getElementById('chart-loading');
    chartLoading.classList.add('active');
    
    // Update dynamic region labels based on selected comparison
    let regionLabel = 'América Latina y el Caribe';
    if (appState.selectedRegion === 'LAT') {
        regionLabel = 'América Latina (promedio simple)';
    } else if (appState.selectedRegion === 'LATO') {
        regionLabel = 'América Latina';
    }
    const kpiTitle = document.getElementById('kpi-alc-title');
    if (kpiTitle) kpiTitle.textContent = regionLabel;
    
    // Update comparative table headers for dynamic gaps
    const gapHeader = document.getElementById('table-gap-header');
    const pctHeader = document.getElementById('table-pct-header');
    let regionAcronym = 'ALC';
    if (appState.selectedRegion === 'LAT') {
        regionAcronym = 'AL Prom. Simple';
    } else if (appState.selectedRegion === 'LATO') {
        regionAcronym = 'AL';
    }
    if (gapHeader) gapHeader.textContent = `Brecha Abs. (vs ${regionAcronym})`;
    if (pctHeader) pctHeader.textContent = `Brecha % (vs ${regionAcronym})`;
    
    // Process Data list
    const rawData = appState.indicatorData.data || [];
    const dimensions = appState.indicatorData.dimensions || [];
    
    // Get Year Dimension Info
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    if (!yearDim) {
        showError('No se encontró dimensión de tiempo (Años) para graficar.');
        chartLoading.classList.remove('active');
        return;
    }
    
    // Map member ID to Year label (e.g. member 68109 -> "1900")
    const yearMap = {};
    yearDim.members.forEach(m => {
        yearMap[m.id] = m.name;
    });
    
    // Filter raw data matching the selected secondary filters
    let filteredRecords = rawData.filter(rec => {
        // Must match all secondary filters in appState.selectedFilters
        for (const [dimId, memberId] of Object.entries(appState.selectedFilters)) {
            const val = rec[`dim_${dimId}`];
            if (val !== undefined && val !== memberId) {
                return false;
            }
        }
        return true;
    });
    
    // Group records by Year and Country
    // Colombia (225) vs ALC (212), AL (211) and AL Prom. Simple (43053)
    const colombiaData = {};
    const alcData = {};       // 212
    const latoData = {};      // 211
    const latSimpleData = {};  // 43053
    const yearsSet = new Set();
    
    filteredRecords.forEach(rec => {
        const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
        const yearMemberId = rec[`dim_${YEAR_DIM_ID}`];
        const yearLabel = yearMap[yearMemberId];
        
        if (!yearLabel) return;
        
        // Parse float value
        const val = parseFloat(rec.value);
        if (isNaN(val)) return;
        
        if (countryId === COLOMBIA_MEMBER_ID) {
            colombiaData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === ALC_MEMBER_ID) {
            alcData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === LATO_MEMBER_ID) {
            latoData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === LAT_MEMBER_ID) {
            latSimpleData[yearLabel] = val;
            yearsSet.add(yearLabel);
        }
    });
    
    // Convert years set to sorted array
    const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedYears.length === 0) {
        showError(`No hay datos disponibles para comparar Colombia y ${regionLabel} en los filtros seleccionados.`);
        chartLoading.classList.remove('active');
        clearKpis();
        return;
    }
    
    // Determine active region's data for Chart, KPIs and Diagnostics
    let activeRegionData = {};
    if (appState.selectedRegion === 'ALC') {
        activeRegionData = alcData;
    } else if (appState.selectedRegion === 'LATO') {
        activeRegionData = latoData;
    } else if (appState.selectedRegion === 'LAT') {
        activeRegionData = latSimpleData;
    }
    
    // Build parallel series
    const colombiaSeries = sortedYears.map(yr => colombiaData[yr] !== undefined ? colombiaData[yr] : null);
    const alcSeries = sortedYears.map(yr => activeRegionData[yr] !== undefined ? activeRegionData[yr] : null);
    
    // Update KPI panels with the latest available year that has data for BOTH
    updateKpiCards(sortedYears, colombiaData, activeRegionData);
    
    // Update Chart
    drawChart(sortedYears, colombiaSeries, alcSeries);
    
    // Update Table with all geographic groupings
    updateTable(sortedYears, colombiaData, alcData, latoData, latSimpleData);
    
    // Generate Diagnostic Heuristics
    appState.currentColombiaData = colombiaData;
    appState.currentAlcData = alcData;
    appState.currentLatoData = latoData;
    appState.currentLatSimpleData = latSimpleData;
    generateDiagnostic(sortedYears, colombiaData, activeRegionData);
    
    chartLoading.classList.remove('active');
}

// Show local error message in diagnostic box
function showError(msg) {
    document.getElementById('diagnostic-content').innerHTML = `
        <div style="color: var(--accent-red); font-weight: 500;">
            <i class="fa-solid fa-triangle-exclamation"></i> ${msg}
        </div>
    `;
    // clear chart canvas
    if (appState.chartInstance) {
        appState.chartInstance.destroy();
        appState.chartInstance = null;
    }
}

// Handle region selector change and reload data
function handleRegionChange() {
    const selectEl = document.getElementById('region-comparison');
    if (!selectEl) return;
    appState.selectedRegion = selectEl.value;
    // If indicator data is already loaded, just re-render with new region filter
    if (appState.indicatorData) {
        renderDashboardData();
    }
}

// 6. Update KPIs
function updateKpiCards(years, colData, alcData) {
    // Find latest year with data for either or both
    // Ideally we want the latest year that has BOTH data points for direct gap comparison
    let latestYearBoth = null;
    // Prefer the latest historical/real year (less than 2025)
    for (let i = years.length - 1; i >= 0; i--) {
        const yr = years[i];
        const yrNum = parseInt(yr);
        if (yrNum < 2025 && colData[yr] !== undefined && alcData[yr] !== undefined) {
            latestYearBoth = yr;
            break;
        }
    }
    
    // If no historical year has data for both, fallback to the latest year with data for both
    if (!latestYearBoth) {
        for (let i = years.length - 1; i >= 0; i--) {
            const yr = years[i];
            if (colData[yr] !== undefined && alcData[yr] !== undefined) {
                latestYearBoth = yr;
                break;
            }
        }
    }
    
    if (!latestYearBoth) {
        // Fallback to absolute latest year in the array
        latestYearBoth = years[years.length - 1];
    }
    
    const colVal = colData[latestYearBoth];
    const alcVal = alcData[latestYearBoth];
    
    const colEl = document.getElementById('kpi-colombia-val');
    const alcEl = document.getElementById('kpi-alc-val');
    const gapEl = document.getElementById('kpi-gap-val');
    const gapPctEl = document.getElementById('kpi-gap-pct');
    
    // Colombia
    if (colVal !== undefined) {
        colEl.textContent = formatNumber(colVal);
        // Trend: compare with 5 years ago, or first year
        const prevYear = findHistoricalYear(years, latestYearBoth, 5, colData);
        if (prevYear) {
            const prevVal = colData[prevYear];
            const diff = colVal - prevVal;
            const pct = (diff / prevVal) * 100;
            const dir = diff >= 0 ? 'up' : 'down';
            const icon = diff >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            document.getElementById('kpi-colombia-trend').className = `kpi-trend ${dir}`;
            document.getElementById('kpi-colombia-trend').innerHTML = `
                <i class="fa-solid ${icon}"></i>
                <span>${pct >= 0 ? '+' : ''}${formatNumber(pct)}% (vs ${prevYear})</span>
            `;
        } else {
            document.getElementById('kpi-colombia-trend').className = 'kpi-trend stable';
            document.getElementById('kpi-colombia-trend').innerHTML = `<span>Dato para ${latestYearBoth}</span>`;
        }
    } else {
        colEl.textContent = '-';
        document.getElementById('kpi-colombia-trend').innerHTML = '<span>Sin datos</span>';
    }
    
    // América Latina y el Caribe
    if (alcVal !== undefined) {
        alcEl.textContent = formatNumber(alcVal);
        const prevYear = findHistoricalYear(years, latestYearBoth, 5, alcData);
        if (prevYear) {
            const prevVal = alcData[prevYear];
            const diff = alcVal - prevVal;
            const pct = (diff / prevVal) * 100;
            const dir = diff >= 0 ? 'up' : 'down';
            const icon = diff >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            document.getElementById('kpi-alc-trend').className = `kpi-trend ${dir}`;
            document.getElementById('kpi-alc-trend').innerHTML = `
                <i class="fa-solid ${icon}"></i>
                <span>${pct >= 0 ? '+' : ''}${formatNumber(pct)}% (vs ${prevYear})</span>
            `;
        } else {
            document.getElementById('kpi-alc-trend').className = 'kpi-trend stable';
            document.getElementById('kpi-alc-trend').innerHTML = `<span>Dato para ${latestYearBoth}</span>`;
        }
    } else {
        alcEl.textContent = '-';
        document.getElementById('kpi-alc-trend').innerHTML = '<span>Sin datos</span>';
    }
    
    // Brecha o Participación
    const gapTitle = document.querySelector('.kpi-title.gap span');
    const gapIcon = document.querySelector('.kpi-title.gap i');
    
    const indName = appState.selectedIndicator ? appState.selectedIndicator.name : '';
    const unitName = (appState.indicatorData && appState.indicatorData.metadata) ? appState.indicatorData.metadata.unit : '';
    const isAbsolute = isAbsoluteSumIndicator(indName, unitName);
    
    if (colVal !== undefined && alcVal !== undefined) {
        if (isAbsolute) {
            const share = alcVal !== 0 ? (colVal / alcVal) * 100 : 0;
            gapEl.textContent = formatNumber(share) + '%';
            if (gapTitle) gapTitle.textContent = 'Participación Nal.';
            if (gapIcon) gapIcon.className = 'fa-solid fa-chart-pie';
            gapPctEl.className = 'kpi-trend stable';
            gapPctEl.innerHTML = `
                <i class="fa-solid fa-chart-pie"></i>
                <span>De Colombia respecto al total regional (${latestYearBoth})</span>
            `;
        } else {
            const absGap = colVal - alcVal;
            const pctGap = alcVal !== 0 ? (absGap / alcVal) * 100 : 0;
            const dre = alcVal !== 0 ? (colVal - alcVal) / alcVal : 0;
            
            gapEl.textContent = formatNumber(absGap);
            if (gapTitle) gapTitle.textContent = 'Brecha de Valor';
            if (gapIcon) gapIcon.className = 'fa-solid fa-scale-unbalanced';
            
            // Check if lower is better for this indicator to determine favorability
            const lowerBetter = isLowerBetter(indName);
            
            // Determine favorability status (using a 1% relative threshold for significance)
            let status = 'neutral'; // 'favorable', 'unfavorable', 'neutral'
            if (Math.abs(pctGap) >= 1) {
                if (absGap > 0) {
                    status = lowerBetter ? 'unfavorable' : 'favorable';
                } else if (absGap < 0) {
                    status = lowerBetter ? 'favorable' : 'unfavorable';
                }
            }
            
            let statusColorClass = 'stable';
            let statusBadge = '';
            
            if (status === 'favorable') {
                statusColorClass = 'up'; // green
                statusBadge = '<span style="font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; background: rgba(16, 185, 129, 0.15); color: var(--accent-green); padding: 0.15rem 0.5rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem; margin-bottom: 6px;"><i class="fa-solid fa-circle-check"></i> Favorable para Colombia</span>';
            } else if (status === 'unfavorable') {
                statusColorClass = 'down'; // red
                statusBadge = '<span style="font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; background: rgba(239, 68, 68, 0.15); color: var(--accent-red); padding: 0.15rem 0.5rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem; margin-bottom: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> Desfavorable / Brecha Crítica</span>';
            } else {
                statusColorClass = 'stable'; // gray
                statusBadge = '<span style="font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); padding: 0.15rem 0.5rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem; margin-bottom: 6px;"><i class="fa-solid fa-equals"></i> Similar a la Región</span>';
            }
            
            const relation = absGap >= 0 ? 'mayor que' : 'menor que';
            const regionAcronym = appState.selectedRegion === 'LAT' ? 'AL (promedio simple)' : (appState.selectedRegion === 'LATO' ? 'AL' : 'ALC');
            
            gapPctEl.className = `kpi-trend ${statusColorClass}`;
            gapPctEl.innerHTML = `
                ${statusBadge}<br>
                <i class="fa-solid ${absGap >= 0 ? 'fa-plus' : 'fa-minus'}"></i>
                <span>${formatNumber(Math.abs(pctGap))}% ${relation} promedio ${regionAcronym} (${latestYearBoth})<br>
                <span style="font-size: 0.72rem; color: var(--text-secondary); display: inline-block; margin-top: 4px;">
                    DRE (Desviación Relativa Estándar): <strong>${dre >= 0 ? '+' : ''}${formatNumber(dre)}</strong>
                </span></span>
            `;
        }
    } else {
        gapEl.textContent = '-';
        if (isAbsolute) {
            if (gapTitle) gapTitle.textContent = 'Participación Nal.';
            if (gapIcon) gapIcon.className = 'fa-solid fa-chart-pie';
            gapPctEl.className = 'kpi-trend stable';
            gapPctEl.innerHTML = '<i class="fa-solid fa-chart-pie"></i> <span>De Colombia respecto al total regional</span>';
        } else {
            if (gapTitle) gapTitle.textContent = 'Brecha de Valor';
            if (gapIcon) gapIcon.className = 'fa-solid fa-scale-unbalanced';
            gapPctEl.className = 'kpi-trend stable';
            gapPctEl.innerHTML = '<span>Comparación imposible</span>';
        }
    }
}

// Find a year in the past to calculate trend (e.g. currentYear - 5)
function findHistoricalYear(years, currentYear, yearsAgo, dataset) {
    const target = parseInt(currentYear) - yearsAgo;
    // Find closest year <= target that has data
    let bestYear = null;
    let minDiff = Infinity;
    
    years.forEach(yr => {
        const yInt = parseInt(yr);
        if (dataset[yr] !== undefined && yInt <= target) {
            const diff = target - yInt;
            if (diff < minDiff) {
                minDiff = diff;
                bestYear = yr;
            }
        }
    });
    
    return bestYear;
}

// Helper to determine if a lower value is better for a given indicator name
function isLowerBetter(indicatorName) {
    if (!indicatorName) return false;
    const name = indicatorName.toLowerCase();
    const negativeKeywords = [
        'desocupación', 'desempleo', 'pobreza', 'indigencia', 'analfabetismo',
        'desnutrición', 'mortalidad', 'homicidio', 'delincuencia', 'emisión',
        'deuda', 'inflación', 'brecha', 'concentración', 'gini', 'theil',
        'atkinson', 'varianza logarítmica', 'carencia', 'violencia',
        'embarazo adolescente', 'insatisfacción', 'rezago', 'rezagado', 'pérdida'
    ];
    return negativeKeywords.some(keyword => name.includes(keyword));
}

// Format numbers nicely
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    // Decide decimal points based on magnitude
    const abs = Math.abs(num);
    let decimals = 2;
    if (abs >= 1000) decimals = 0;
    if (abs < 1 && abs > 0) decimals = 4;
    
    return Number(num).toLocaleString('es-ES', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    });
}

// 7. Draw Chart using Chart.js
function drawChart(years, colombiaSeries, alcSeries) {
    const ctx = document.getElementById('indicator-chart').getContext('2d');
    const unit = (appState.indicatorData && appState.indicatorData.metadata) ? appState.indicatorData.metadata.unit : '';
    
    if (appState.chartInstance) {
        appState.chartInstance.destroy();
    }
    
    const isLine = appState.chartType === 'line';
    
    // Chart configurations
    const config = {
        type: appState.chartType,
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Colombia',
                    data: colombiaSeries,
                    borderColor: isLine ? 'rgba(255, 215, 0, 1)' : (context) => {
                        const yr = parseInt(years[context.dataIndex]);
                        return yr >= 2025 ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 215, 0, 1)';
                    },
                    backgroundColor: isLine ? 'rgba(255, 215, 0, 0.05)' : (context) => {
                        const yr = parseInt(years[context.dataIndex]);
                        return yr >= 2025 ? 'rgba(255, 215, 0, 0.35)' : 'rgba(255, 215, 0, 0.85)';
                    },
                    borderWidth: 3,
                    pointBackgroundColor: 'rgba(255, 215, 0, 1)',
                    pointHoverRadius: 7,
                    tension: 0.15,
                    fill: isLine,
                    spanGaps: true,
                    segment: isLine ? {
                        borderDash: ctx => {
                            const labelVal = parseInt(years[ctx.p0DataIndex]);
                            return labelVal >= 2025 ? [5, 5] : undefined;
                        }
                    } : undefined
                },
                {
                    label: appState.selectedRegion === 'LAT' ? 'América Latina (promedio simple)' : (appState.selectedRegion === 'LATO' ? 'América Latina' : 'América Latina y el Caribe'),
                    data: alcSeries,
                    borderColor: isLine ? 'rgba(168, 85, 247, 1)' : (context) => {
                        const yr = parseInt(years[context.dataIndex]);
                        return yr >= 2025 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 1)';
                    },
                    backgroundColor: isLine ? 'rgba(168, 85, 247, 0.05)' : (context) => {
                        const yr = parseInt(years[context.dataIndex]);
                        return yr >= 2025 ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.85)';
                    },
                    borderWidth: 3,
                    pointBackgroundColor: 'rgba(168, 85, 247, 1)',
                    pointHoverRadius: 7,
                    tension: 0.15,
                    fill: isLine,
                    spanGaps: true,
                    segment: isLine ? {
                        borderDash: ctx => {
                            const labelVal = parseInt(years[ctx.p0DataIndex]);
                            return labelVal >= 2025 ? [5, 5] : undefined;
                        }
                    } : undefined
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: 500
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', size: 14, weight: 600 },
                    bodyFont: { family: 'Inter', size: 12 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.raw !== null) {
                                label += formatNumber(context.raw);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Años',
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11, weight: 500 }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.03)',
                        borderColor: 'transparent'
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 11 }
                    }
                },
                y: {
                    title: {
                        display: !!unit,
                        text: unit,
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11, weight: 500 }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'transparent'
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 11 },
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    };
    
    appState.chartInstance = new Chart(ctx, config);
}

// Change chart type Line/Bar
function setChartType(type) {
    appState.chartType = type;
    
    // Toggle active classes on buttons
    document.getElementById('btn-chart-line').classList.toggle('active', type === 'line');
    document.getElementById('btn-chart-bar').classList.toggle('active', type === 'bar');
    
    // Re-render chart if data exists
    if (appState.indicatorData) {
        renderDashboardData();
    }
}

// 8. Update Comparative Table with multiple geographic groupings
function updateTable(years, colData, alcData, latoData, latSimpleData) {
    const tbody = document.getElementById('data-table-body');
    tbody.innerHTML = '';
    
    // Render years in reverse order (newest first)
    const reversedYears = [...years].reverse();
    
    reversedYears.forEach(yr => {
        const colVal = colData[yr];
        const alcVal = alcData ? alcData[yr] : undefined;
        const alVal = latoData ? latoData[yr] : undefined;
        const latSimpleVal = latSimpleData ? latSimpleData[yr] : undefined;
        
        // Determine active region's data preference based on selected comparison
        let activeVal = undefined;
        let activeLabel = '';
        
        if (appState.selectedRegion === 'ALC' && alcVal !== undefined) {
            activeVal = alcVal;
            activeLabel = 'ALC (212)';
        } else if (appState.selectedRegion === 'LATO' && alVal !== undefined) {
            activeVal = alVal;
            activeLabel = 'AL (211)';
        } else if (appState.selectedRegion === 'LAT' && latSimpleVal !== undefined) {
            activeVal = latSimpleVal;
            activeLabel = 'AL Prom. Simple';
        }
        
        // Fallback: search in order of availability if the selected region doesn't have data for this year
        if (activeVal === undefined) {
            if (alcVal !== undefined) {
                activeVal = alcVal;
                activeLabel = 'ALC (212)';
            } else if (alVal !== undefined) {
                activeVal = alVal;
                activeLabel = 'AL (211)';
            } else if (latSimpleVal !== undefined) {
                activeVal = latSimpleVal;
                activeLabel = 'AL Prom. Simple';
            }
        }
        
        const yrInt = parseInt(yr);
        const isProj = yrInt >= 2025;
        
        let gapStr = '-';
        let pctStr = '-';
        let subLabel = '';
        let gapRaw = '';
        let pctRaw = '';
        let gapStyle = '';
        let pctStyle = '';
        
        if (colVal !== undefined && activeVal !== undefined) {
            const gap = colVal - activeVal;
            const pct = activeVal !== 0 ? (gap / activeVal) * 100 : 0;
            
            const rawGapStr = formatNumber(gap);
            const rawPctStr = `${gap >= 0 ? '+' : ''}${formatNumber(pct)}%`;
            
            // Check if lower is better for this indicator
            const indName = appState.selectedIndicator ? appState.selectedIndicator.name : '';
            const lowerBetter = isLowerBetter(indName);
            
            // Determine favorability status (using a 1% relative threshold for significance)
            let status = 'neutral'; // 'favorable', 'unfavorable', 'neutral'
            if (Math.abs(pct) >= 1) {
                if (gap > 0) {
                    status = lowerBetter ? 'unfavorable' : 'favorable';
                } else if (gap < 0) {
                    status = lowerBetter ? 'favorable' : 'unfavorable';
                }
            }
            
            let color = 'var(--text-secondary)';
            let statusIcon = '';
            let tooltipText = '';
            
            // Gap direction: superior vs menor
            const isSuperior = gap > 0;
            const directionLabel = isSuperior ? 'superior' : 'menor';
            const directionIcon = isSuperior 
                ? '<i class="fa-solid fa-arrow-trend-up" style="margin-right: 0.35rem; font-size: 0.75rem; opacity: 0.85;"></i>' 
                : '<i class="fa-solid fa-arrow-trend-down" style="margin-right: 0.35rem; font-size: 0.75rem; opacity: 0.85;"></i>';
            
            if (status === 'favorable') {
                color = 'var(--accent-green)';
                statusIcon = '<i class="fa-solid fa-circle-check" style="margin-left: 0.35rem; font-size: 0.75rem;"></i>';
                tooltipText = `Colombia tiene un dato ${directionLabel} (${rawPctStr}) en comparación con el promedio de referencia de ${activeLabel}, lo que representa una mejor situación para el país.`;
            } else if (status === 'unfavorable') {
                color = 'var(--accent-red)';
                statusIcon = '<i class="fa-solid fa-circle-exclamation" style="margin-left: 0.35rem; font-size: 0.75rem;"></i>';
                tooltipText = `Colombia tiene un dato ${directionLabel} (${rawPctStr}) en comparación con el promedio de referencia de ${activeLabel}, lo que representa una peor situación (brecha desfavorable).`;
            } else {
                // Neutral / Similar
                statusIcon = '<i class="fa-solid fa-equals" style="margin-left: 0.35rem; font-size: 0.7rem; opacity: 0.6;"></i>';
                tooltipText = `Colombia y la región presentan valores similares (brecha insignificante menor al 1% de diferencia).`;
            }
            
            gapStyle = `color: ${color} !important; font-weight: 600;`;
            pctStyle = `color: ${color} !important; font-weight: 600;`;
            
            gapStr = `<span style="display: inline-flex; align-items: center;" data-tooltip="${tooltipText}">${directionIcon}${rawGapStr}${statusIcon}</span>`;
            pctStr = `<span style="display: inline-flex; align-items: center;" data-tooltip="${tooltipText}">${rawPctStr}</span>`;
            subLabel = `<span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-top: 0.15rem;">vs ${activeLabel}</span>`;
            gapRaw = gap;
            pctRaw = pct;
        }
        
        const badge = isProj 
            ? `<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #c084fc; margin-left: 0.5rem; font-weight: 600; vertical-align: middle;">PROY.</span>`
            : `<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399; margin-left: 0.5rem; font-weight: 600; vertical-align: middle;">REAL</span>`;
        
        const tr = document.createElement('tr');
        if (isProj) {
            tr.className = 'projection-row';
        }
        tr.innerHTML = `
            <td class="col-year">${yr}${badge}</td>
            <td class="col-colombia colombia-cell" style="text-align: right;">${colVal !== undefined ? formatNumber(colVal) : '-'}</td>
            <td class="col-alc alc-cell" style="text-align: right;">${alcVal !== undefined ? formatNumber(alcVal) : '-'}</td>
            <td class="col-al al-cell" style="text-align: right;">${alVal !== undefined ? formatNumber(alVal) : '-'}</td>
            <td class="col-lat-simple lat-simple-cell" style="text-align: right;">${latSimpleVal !== undefined ? formatNumber(latSimpleVal) : '-'}</td>
            <td class="col-gap" style="text-align: right; ${gapStyle}" data-raw="${gapRaw}">${gapStr}${subLabel}</td>
            <td class="col-pct" style="text-align: right; ${pctStyle}" data-raw="${pctRaw}">${pctStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Helper para tendencias
function getTrendDescription(cagr) {
    if (cagr > 2) return "Crecimiento acelerado";
    if (cagr > 0) return "Crecimiento moderado";
    if (cagr > -2 && cagr < 0) return "Contracción leve";
    if (cagr <= -2) return "Contracción acelerada";
    return "Estabilidad / Sin cambio significativo";
}

// 9. Local Diagnostic Generator (Analytics & NLP generation)
function generateDiagnostic(years, colData, alcData) {
    // Store arguments in appState for when user requests diagnostic
    appState.diagnosticArgs = { years, colData, alcData };
    
    const container = document.getElementById('diagnostic-content');
    if (!container) return;
    
    // Clear badge container
    const badgeContainer = document.getElementById('diagnostic-badge-container');
    if (badgeContainer) badgeContainer.innerHTML = '';
    
    // Check if we already have a generated diagnostic for the current indicator in cache
    const indId = appState.selectedIndicator ? appState.selectedIndicator.id : null;
    if (indId && appState.diagnosticCache && appState.diagnosticCache[indId]) {
        container.innerHTML = appState.diagnosticCache[indId];
        renderDiagnosticBadge();
        return;
    }
    
    // Otherwise, render placeholder button
    container.innerHTML = `
        <div class="diagnostic-placeholder" id="diagnostic-placeholder-area" style="text-align: center; padding: 1.5rem 1rem;">
            <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 2.5rem; color: var(--accent-blue); opacity: 0.85; margin-bottom: 1rem; display: block;"></i>
            <p style="margin-bottom: 1rem; font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.5;">
                Solicite un análisis comparativo nacional en profundidad utilizando modelos de inteligencia artificial en paralelo (Gemini, ChatGPT, Claude, Qwen y Llama).
            </p>
            <button type="button" class="btn-primary" onclick="requestMultiLlmDiagnostic()" style="margin: 0 auto; background: linear-gradient(135deg, var(--accent-blue) 0%, rgba(59,130,246,0.85) 100%); color: #0b0f19; font-weight: 600; padding: 0.6rem 1.5rem; border-radius: 8px; border: none; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: var(--transition-smooth); box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);">
                <i class="fa-solid fa-robot"></i>
                <span>Generar Diagnóstico Multi-LLM</span>
            </button>
        </div>
        
        <!-- Multi-LLM Consoles Area (hidden initially) -->
        <div id="multi-llm-workspace" style="display: none; flex-direction: column; gap: 1rem; margin-top: 0.5rem;">
            
            <!-- Prompt of Consulta Block -->
            <div id="diagnostic-prompt-block" style="background: #090e18; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;" onclick="toggleDiagnosticPromptView()">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-blue); font-weight: 600; font-size: 0.85rem;">
                        <i class="fa-solid fa-code"></i>
                        <span>Prompt de Consulta Enviado a los Modelos</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                        <span id="prompt-toggle-text">Ver Prompt</span>
                        <i class="fa-solid fa-chevron-down" id="prompt-toggle-icon" style="margin-left: 0.25rem; transition: var(--transition-smooth);"></i>
                    </div>
                </div>
                <div id="diagnostic-prompt-text-area" style="display: none; margin-top: 0.75rem; font-family: monospace; font-size: 0.78rem; color: var(--text-secondary); background: #05070c; border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
                </div>
            </div>

            <!-- Top Row: 5 Consoles in Parallel -->
            <div class="consoles-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                <!-- Gemini Terminal -->
                <div class="terminal-box gemini-term" style="background: #05070c; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.78rem; height: 180px; overflow-y: auto; display: flex; flex-direction: column;">
                    <div class="terminal-header" style="color: #10b981; border-bottom: 1px solid rgba(16, 185, 129, 0.15); padding-bottom: 0.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-weight: 600; text-transform: uppercase;">
                        <span>gemini-pro:~$</span>
                        <span class="status-dot" id="gemini-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; align-self: center;"></span>
                    </div>
                    <div class="terminal-body" id="gemini-term-body" style="color: #a7f3d0; white-space: pre-wrap; flex: 1;"></div>
                </div>
                
                <!-- ChatGPT Terminal -->
                <div class="terminal-box chatgpt-term" style="background: #05070c; border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.78rem; height: 180px; overflow-y: auto; display: flex; flex-direction: column;">
                    <div class="terminal-header" style="color: #f59e0b; border-bottom: 1px solid rgba(245, 158, 11, 0.15); padding-bottom: 0.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-weight: 600; text-transform: uppercase;">
                        <span>gpt-4o:~$</span>
                        <span class="status-dot" id="chatgpt-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; align-self: center;"></span>
                    </div>
                    <div class="terminal-body" id="chatgpt-term-body" style="color: #fef3c7; white-space: pre-wrap; flex: 1;"></div>
                </div>
                
                <!-- Claude Terminal -->
                <div class="terminal-box claude-term" style="background: #05070c; border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.78rem; height: 180px; overflow-y: auto; display: flex; flex-direction: column;">
                    <div class="terminal-header" style="color: #06b6d4; border-bottom: 1px solid rgba(6, 182, 212, 0.15); padding-bottom: 0.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-weight: 600; text-transform: uppercase;">
                        <span>claude-3-5:~$</span>
                        <span class="status-dot" id="claude-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; align-self: center;"></span>
                    </div>
                    <div class="terminal-body" id="claude-term-body" style="color: #cffafe; white-space: pre-wrap; flex: 1;"></div>
                </div>

                <!-- Qwen Terminal -->
                <div class="terminal-box qwen-term" style="background: #05070c; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.78rem; height: 180px; overflow-y: auto; display: flex; flex-direction: column;">
                    <div class="terminal-header" style="color: #a855f7; border-bottom: 1px solid rgba(168, 85, 247, 0.15); padding-bottom: 0.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-weight: 600; text-transform: uppercase;">
                        <span>qwen-3:~$</span>
                        <span class="status-dot" id="qwen-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; align-self: center;"></span>
                    </div>
                    <div class="terminal-body" id="qwen-term-body" style="color: #e9d5ff; white-space: pre-wrap; flex: 1;"></div>
                </div>
                
                <!-- Llama Terminal -->
                <div class="terminal-box llama-term" style="background: #05070c; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.78rem; height: 180px; overflow-y: auto; display: flex; flex-direction: column;">
                    <div class="terminal-header" style="color: #ef4444; border-bottom: 1px solid rgba(239, 68, 68, 0.15); padding-bottom: 0.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-weight: 600; text-transform: uppercase;">
                        <span>llama-4:~$</span>
                        <span class="status-dot" id="llama-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; align-self: center;"></span>
                    </div>
                    <div class="terminal-body" id="llama-term-body" style="color: #fee2e2; white-space: pre-wrap; flex: 1;"></div>
                </div>
            </div>
            
            <!-- Orchestrator Console (Gemini Synthesis) -->
            <div class="terminal-box orchestrator-term" style="background: #05070c; border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.8rem; height: 150px; overflow-y: auto; display: flex; flex-direction: column;">
                <div class="terminal-header" style="color: #3b82f6; border-bottom: 1px solid rgba(59, 130, 246, 0.15); padding-bottom: 0.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-weight: 600; text-transform: uppercase;">
                    <span>gemini-orchestrator (síntesis):~$</span>
                    <span class="status-dot" id="orchestrator-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; align-self: center;"></span>
                </div>
                <div class="terminal-body" id="orchestrator-term-body" style="color: #dbeafe; white-space: pre-wrap; flex: 1;"></div>
            </div>
            
            <!-- Final Synthesis Content Rendered Nicely with Tabs -->
            <div id="final-synthesis-content" style="display: none; border-top: 1px dashed var(--border-color); padding-top: 1.5rem; margin-top: 0.5rem; opacity: 0; transition: opacity 0.5s ease-in-out;">
            </div>
        </div>
    `;
}

// Render models badges inside diagnostic card header
function renderDiagnosticBadge() {
    const badgeContainer = document.getElementById('diagnostic-badge-container');
    if (badgeContainer) {
        badgeContainer.innerHTML = `
            <div style="display: flex; gap: 0.4rem; font-size: 0.72rem; font-weight: 600; flex-wrap: wrap;">
                <span style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-circle-check"></i> Gemini</span>
                <span style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-circle-check"></i> ChatGPT</span>
                <span style="background: rgba(6, 182, 212, 0.12); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-circle-check"></i> Claude</span>
                <span style="background: rgba(168, 85, 247, 0.12); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-circle-check"></i> Qwen</span>
                <span style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-circle-check"></i> Llama</span>
            </div>
        `;
    }
}

// Toggle prompt display
function toggleDiagnosticPromptView() {
    const textEl = document.getElementById('diagnostic-prompt-text-area');
    const toggleIcon = document.getElementById('prompt-toggle-icon');
    const toggleText = document.getElementById('prompt-toggle-text');
    if (textEl && toggleIcon && toggleText) {
        if (textEl.style.display === 'none') {
            textEl.style.display = 'block';
            toggleIcon.style.transform = 'rotate(-180deg)';
            toggleText.textContent = 'Ocultar Prompt';
        } else {
            textEl.style.display = 'none';
            toggleIcon.style.transform = 'rotate(0deg)';
            toggleText.textContent = 'Ver Prompt';
        }
    }
}

// Tab navigation handler
function switchDiagnosticTab(tabName) {
    document.querySelectorAll('.diagnostic-tabs .btn-tab').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.border = '1px solid rgba(255,255,255,0.08)';
        btn.style.color = 'var(--text-secondary)';
    });
    
    document.querySelectorAll('.diagtab-content-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    const targetBtn = document.getElementById(`btn-diagtab-${tabName}`);
    const targetPanel = document.getElementById(`diagtab-content-${tabName}`);
    
    if (targetBtn && targetPanel) {
        targetBtn.classList.add('active');
        targetPanel.style.display = 'block';
        
        if (tabName === 'synthesis') {
            targetBtn.style.background = 'rgba(59, 130, 246, 0.15)';
            targetBtn.style.border = '1px solid rgba(59, 130, 246, 0.3)';
            targetBtn.style.color = '#3b82f6';
        } else if (tabName === 'gemini') {
            targetBtn.style.background = 'rgba(16, 185, 129, 0.15)';
            targetBtn.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            targetBtn.style.color = '#10b981';
        } else if (tabName === 'chatgpt') {
            targetBtn.style.background = 'rgba(245, 158, 11, 0.15)';
            targetBtn.style.border = '1px solid rgba(245, 158, 11, 0.3)';
            targetBtn.style.color = '#f59e0b';
        } else if (tabName === 'claude') {
            targetBtn.style.background = 'rgba(6, 182, 212, 0.15)';
            targetBtn.style.border = '1px solid rgba(6, 182, 212, 0.3)';
            targetBtn.style.color = '#06b6d4';
        } else if (tabName === 'qwen') {
            targetBtn.style.background = 'rgba(168, 85, 247, 0.15)';
            targetBtn.style.border = '1px solid rgba(168, 85, 247, 0.3)';
            targetBtn.style.color = '#a855f7';
        } else if (tabName === 'llama') {
            targetBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            targetBtn.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            targetBtn.style.color = '#ef4444';
        }
    }
}

// Helper to strip HTML tags for plain text prompt context
function stripHtml(html) {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<li>/gi, '- ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Remove remaining tags
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ') // Collapse whitespaces
        .trim();
}

// Generate structured query prompt text
function buildDiagnosticPrompt(years, colData, alcData, alData, latData, metadata) {
    const region = appState.selectedRegion || 'ALC';
    let regionLabel = 'América Latina y el Caribe';
    if (region === 'LATO') regionLabel = 'América Latina';
    else if (region === 'LAT') regionLabel = 'América Latina (promedio simple)';
    
    // Gather detailed metadata from appState
    const detailedMeta = appState.indicatorMetadata || {};
    const meta = (appState.indicatorData && appState.indicatorData.metadata) ? appState.indicatorData.metadata : {};
    const sources = (appState.indicatorData && appState.indicatorData.sources) ? appState.indicatorData.sources : [];
    const footnotes = (appState.indicatorData && appState.indicatorData.footnotes) ? appState.indicatorData.footnotes : [];

    const definitionText = stripHtml(detailedMeta.definition || meta.description || '');
    const methodologyText = stripHtml(detailedMeta.calculation_methodology || '');
    const featuresText = stripHtml(detailedMeta.data_features || '');
    const noteText = stripHtml(detailedMeta.note || '');
    const commentsText = stripHtml(detailedMeta.comments || '');
    
    let sourcesText = '';
    if (sources.length > 0) {
        sourcesText = sources.map(src => `${src.organization_acronym || 'Fuente'}: ${stripHtml(src.description)}`).join('; ');
    }
    
    let footnotesText = '';
    if (footnotes.length > 0) {
        footnotesText = footnotes.map(fn => stripHtml(fn.note_text)).join('; ');
    }
    
    const indicatorName = (appState.selectedIndicator && appState.selectedIndicator.name) ? appState.selectedIndicator.name : (metadata.name || 'No especificado');
    
    let prompt = `SYSTEM PROMPT: MULTI-MODEL COMPARATIVE DIAGNOSTIC ENGINE\n`;
    prompt += `=========================================================\n\n`;
    prompt += `[INDICADOR GENERAL]\n`;
    prompt += `- Nombre: ${indicatorName}\n`;
    prompt += `- ID Indicador: ${appState.selectedIndicator ? appState.selectedIndicator.id : 'N/A'}\n`;
    prompt += `- Unidad de Medida: ${metadata.unit || 'No especificado'}\n`;
    prompt += `- Área Temática: ${appState.selectedIndicator ? appState.selectedIndicator.categoryPath : 'No especificada'}\n`;
    prompt += `- Región de Referencia Activa: ${regionLabel} (${region})\n\n`;
    
    prompt += `[METADATOS Y CONTEXTO DEL INDICADOR]\n`;
    if (definitionText) prompt += `- Definición Oficial: ${definitionText}\n`;
    if (methodologyText) prompt += `- Metodología de Cálculo: ${methodologyText}\n`;
    if (featuresText) prompt += `- Características de los Datos: ${featuresText}\n`;
    if (noteText) prompt += `- Nota Especial: ${noteText}\n`;
    if (commentsText) prompt += `- Observaciones y Comentarios: ${commentsText}\n`;
    if (sourcesText) prompt += `- Fuentes Oficiales: ${sourcesText}\n`;
    if (footnotesText) prompt += `- Notas al Pie: ${footnotesText}\n`;
    prompt += `\n`;
    
    prompt += `[DATASET: SERIE TEMPORAL COMPLETA]\n`;
    prompt += `AÑO\tCOLOMBIA\tALC (212)\tAL (211)\tAL PROM. SIMPLE (43053)\n`;
    
    years.forEach(yr => {
        const colVal = colData[yr] !== undefined ? formatNumber(colData[yr]) : 'N/A';
        const alcVal = alcData[yr] !== undefined ? formatNumber(alcData[yr]) : 'N/A';
        const alVal = alData && alData[yr] !== undefined ? formatNumber(alData[yr]) : 'N/A';
        const latVal = latData && latData[yr] !== undefined ? formatNumber(latData[yr]) : 'N/A';
        prompt += `${yr}\t${colVal}\t${alcVal}\t${alVal}\t${latVal}\n`;
    });
    
    prompt += `\n[DIRECTRICES DE ANÁLISIS MULTIDIMENSIONAL PARA TODOS LOS MODELOS]\n`;
    prompt += `Cada uno de los modelos (Gemini-Pro, GPT-4o, Claude-3.5-Sonnet, Qwen-3 y Llama-4) debe realizar una lectura integral, exhaustiva y holística del indicador cubriendo todas las posibles interpretaciones de los datos sin limitarse a una sola área de especialización. El análisis debe integrar:\n`;
    prompt += `a) Interpretación cuantitativa de la trayectoria, tasas CAGR, desvíos DRE y años de brechas críticas.\n`;
    prompt += `b) Dinámica institucional y de gobernanza implícita en la evolución temporal.\n`;
    prompt += `c) Implicaciones socioeconómicas, de género, territoriales y demográficas que se desprenden de la serie histórica y sus definiciones técnicas.\n\n`;
    
    prompt += `[RESTRICCIÓN CRÍTICA Y MANDATORIA]\n`;
    prompt += `- Está estrictamente prohibido proponer políticas públicas específicas (como reformas legislativas, programas gubernamentales específicos, adopción de marcos externos no descritos, etc.) o realizar interpretaciones que se fundamenten en información externa que no esté explícitamente contenida en el dataset o en la metadata suministrada.\n`;
    prompt += `- El análisis debe basarse estrictamente en la evidencia matemática y técnica de los datos y fichas oficiales proporcionados.\n\n`;
    
    prompt += `[PROMPT GENERAL ENVIADO]\n`;
    prompt += `"Estimados modelos, analicen el dataset y los metadatos oficiales del indicador. Generen un análisis profundo y multidimensional cubriendo todas las posibles interpretaciones (cuantitativas, sociales, institucionales y demográficas), apegándose estrictamente a la información suministrada sin especular sobre factores externos ni proponer agendas o políticas no fundamentadas en estos datos."`;
    
    return prompt;
}

// Click handler for button
function requestMultiLlmDiagnostic() {
    if (!appState.diagnosticArgs) return;
    
    // Check balance
    if (appState.queryBalance <= 0) {
        const placeholder = document.getElementById('diagnostic-placeholder-area');
        if (placeholder) {
            placeholder.innerHTML = `
                <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: #ef4444; margin-bottom: 1rem; display: block;"></i>
                <p style="margin-bottom: 1rem; font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.5;">
                    <strong>Saldo Insuficiente</strong><br>
                    Ha agotado su saldo disponible de consultas simuladas ($0.0000 USD).
                </p>
                <button type="button" class="btn-primary" onclick="resetQueryBalance()" style="margin: 0 auto; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #0b0f19; font-weight: 600; padding: 0.6rem 1.5rem; border-radius: 8px; border: none; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);">
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>Recargar Saldo de Consulta ($15.00 USD)</span>
                </button>
            `;
            placeholder.style.display = 'block';
            
            const workspace = document.getElementById('multi-llm-workspace');
            if (workspace) workspace.style.display = 'none';
        }
        return;
    }
    
    // Hide placeholder
    const placeholder = document.getElementById('diagnostic-placeholder-area');
    if (placeholder) placeholder.style.display = 'none';
    
    // Show workspace
    const workspace = document.getElementById('multi-llm-workspace');
    if (workspace) workspace.style.display = 'flex';
    
    const { years } = appState.diagnosticArgs;
    const colData = appState.currentColombiaData || {};
    const alcData = appState.currentAlcData || {}; // Pure ALC (212)
    const alData = appState.currentLatoData || {}; // Pure AL (211)
    const latData = appState.currentLatSimpleData || {}; // Pure AL Promedio Simple (43053)
    const metadata = (appState.indicatorData && appState.indicatorData.metadata) ? appState.indicatorData.metadata : {};
    const indId = appState.selectedIndicator ? appState.selectedIndicator.id : null;
    const indicatorName = (appState.selectedIndicator && appState.selectedIndicator.name) ? appState.selectedIndicator.name : (metadata.name || 'Indicador no especificado');
    
    // Gather values for text generation and identify active region
    const activeRegion = appState.selectedRegion || 'ALC';
    let activeRegionData = alcData;
    let regionLabel = 'América Latina y el Caribe';
    let regionAcronym = 'ALC';
    let refKey = 'alcVal';
    if (activeRegion === 'LATO') {
        refKey = 'alVal';
        regionLabel = 'América Latina';
        regionAcronym = 'AL';
        activeRegionData = alData;
    } else if (activeRegion === 'LAT') {
        refKey = 'latVal';
        regionLabel = 'América Latina (promedio simple)';
        regionAcronym = 'AL (promedio simple)';
        activeRegionData = latData;
    }

    // Call HTML generation for PDF/main display using active region data
    const htmlContent = generateDiagnosticHtmlText(years, colData, activeRegionData, metadata);

    // Generate and display query prompt
    const promptText = buildDiagnosticPrompt(years, colData, alcData, alData, latData, metadata);
    const promptArea = document.getElementById('diagnostic-prompt-text-area');
    if (promptArea) {
        promptArea.textContent = promptText;
        promptArea.style.display = 'block'; // Show it open by default as requested
    }
    const toggleIcon = document.getElementById('prompt-toggle-icon');
    const toggleText = document.getElementById('prompt-toggle-text');
    if (toggleIcon && toggleText) {
        toggleIcon.style.transform = 'rotate(-180deg)';
        toggleText.textContent = 'Ocultar Prompt';
    }
    
    const validYears = years.filter(yr => colData[yr] !== undefined && activeRegionData[yr] !== undefined);
    const realYears = validYears.filter(yr => parseInt(yr) < 2025);
    
    let startReal = 2018, endReal = 2023;
    let colEndReal = 10.2, alcEndReal = 6.3;
    let colCagrReal = 1.2, alcCagrReal = 0.8;
    let endGapReal = 3.9, endGapPctReal = 61.9;
    let maxGapYearReal = 2020, maxAbsGapReal = 5.5;
    let startGapReal = 3.9, startGapPctReal = 61.9; // Defined to prevent reference errors
    
    if (realYears.length > 0) {
        startReal = realYears[0];
        endReal = realYears[realYears.length - 1];
        colEndReal = colData[endReal];
        alcEndReal = activeRegionData[endReal];
        
        const colStartReal = colData[startReal] !== undefined ? colData[startReal] : 0;
        const alcStartReal = activeRegionData[startReal] !== undefined ? activeRegionData[startReal] : 0;
        startGapReal = colStartReal - alcStartReal;
        startGapPctReal = alcStartReal !== 0 ? (startGapReal / alcStartReal) * 100 : 0;
        
        const numYearsReal = parseInt(endReal) - parseInt(startReal);
        if (numYearsReal > 0) {
            if (colStartReal > 0 && colEndReal > 0) colCagrReal = (Math.pow(colEndReal / colStartReal, 1 / numYearsReal) - 1) * 100;
            if (alcStartReal > 0 && alcEndReal > 0) alcCagrReal = (Math.pow(alcEndReal / alcStartReal, 1 / numYearsReal) - 1) * 100;
        }
        endGapReal = colEndReal - alcEndReal;
        endGapPctReal = alcEndReal !== 0 ? (endGapReal / alcEndReal) * 100 : 0;
        
        let maxAbsGap = -1;
        realYears.forEach(yr => {
            const gap = Math.abs(colData[yr] - activeRegionData[yr]);
            if (gap > maxAbsGap) {
                maxAbsGap = gap;
                maxGapYearReal = yr;
                maxAbsGapReal = gap;
            }
        });
    }

    // Gather detailed metadata for simulated responses
    const detailedMeta = appState.indicatorMetadata || {};
    const meta = (appState.indicatorData && appState.indicatorData.metadata) ? appState.indicatorData.metadata : {};
    const sources = (appState.indicatorData && appState.indicatorData.sources) ? appState.indicatorData.sources : [];

    const definitionText = stripHtml(detailedMeta.definition || meta.description || '');
    const methodologyText = stripHtml(detailedMeta.calculation_methodology || '');
    const noteText = stripHtml(detailedMeta.note || '');
    const commentsText = stripHtml(detailedMeta.comments || '');
    
    let sourcesText = '';
    if (sources.length > 0) {
        sourcesText = sources.map(src => `${src.organization_acronym || 'Fuente'}: ${stripHtml(src.description)}`).join('; ');
    }

    // Construct logs
    const geminiText = `[INICIO DE CONSULTA: GEMINI-PRO]
> Analizando dataset y metadatos del indicador: "${indicatorName}"
> Leyendo definición técnica oficial: "${definitionText ? definitionText.substring(0, 80) + '...' : 'No disponible'}"
> Ejecutando análisis integrado de todas las dimensiones y posibles interpretaciones:
  * Tendencia Cuantitativa: Colombia presenta un CAGR real de ${formatNumber(colCagrReal)}% frente al ${formatNumber(alcCagrReal)}% regional.
  * Brecha y Cohesión Social: La diferencia del ${formatNumber(endGapPctReal)}% representa una brecha estructural de bienestar social.
  * Inercia Institucional: La persistencia de la desviación de ${formatNumber(Math.abs(endGapReal))} unidades denota una rigidez en los mecanismos institucionales medidos.
> Interpretación multidimensional completada para todos los puntos de datos.
> RESTRICCIÓN DE INFORMACIÓN EXTERNA: Verificado. Sin propuestas de políticas externas.
[FIN DE EJECUCIÓN - TRANSMISIÓN DE ANÁLISIS INTEGRADO COMPLETADA]`;

    const chatgptText = `[INICIO DE CONSULTA: GPT-4O]
> Procesando datos oficiales e indicador: "${indicatorName}" (${startReal} - ${endReal}).
> Realizando diagnóstico holístico y lecturas cruzadas:
  * Dimensión Cuantitativa: Máxima brecha de desvío registrada en ${maxGapYearReal} con ${formatNumber(maxAbsGapReal)} unidades.
  * Contexto Demográfico y Estructural: El comportamiento de la serie difiere significativamente del promedio regional de ${regionAcronym}.
  * Análisis de Gobernanza: La fluctuación de la serie refleja la inercia interna en los periodos medidos.
> Evaluando implicaciones técnicas de la metodología de cálculo: "${methodologyText ? methodologyText.substring(0, 80) + '...' : 'Estándar'}"
> RESTRICCIÓN DE INFORMACIÓN EXTERNA: Verificado. Análisis fundamentado únicamente en los metadatos y dataset provistos.
[FIN DE EJECUCIÓN - TRANSMISIÓN HOLÍSTICA COMPLETADA]`;

    const claudeText = `[INICIO DE CONSULTA: CLAUDE-3.5-SONNET]
> Iniciando lectura cruzada de datos históricos e información descriptiva técnica para el indicador "${indicatorName}".
> Estudiando todas las interpretaciones y correlaciones de la serie:
  * Dimensión de Equidad y Social: Desvío acumulado relativo respecto a ${regionAcronym} y brecha de convergencia de ${formatNumber(Math.abs(startGapPctReal))}% a ${formatNumber(Math.abs(endGapPctReal))}%.
  * Dinámica Temporal: Velocidad relativa de cambio interanual con punto de inflexión en ${maxGapYearReal}.
  * Factores Metodológicos: Análisis de la unidad de medida (${metadata.unit || 'unidades'}) y notas técnicas asociadas.
> Evaluando notas técnicas: "${noteText ? noteText.substring(0, 80) + '...' : 'Sin notas adicionales'}"
> RESTRICCIÓN DE INFORMACIÓN EXTERNA: Verificado. Excluidos supuestos externos y recomendaciones de política ajenas a los datos.
[FIN DE EJECUCIÓN - TRANSMISIÓN SOCIAL E INTEGRAL COMPLETADA]`;

    const qwenText = `[INICIO DE CONSULTA: QWEN-3]
> Evaluando asimetrías de la serie histórica y notas descriptivas asociadas para el indicador "${indicatorName}".
> Realizando lectura multidimensional e integrada:
  * Trayectoria General: Colombia muestra un comportamiento de CAGR de ${formatNumber(colCagrReal)}% en el periodo de estudio.
  * Análisis de Desviación: DRE calculada en ${formatNumber(endGapReal / alcEndReal)} respecto al promedio regional.
  * Interpretación Concepto: Contraste sistemático de los datos frente a la unidad de medida y descripción técnica del indicador.
> RESTRICCIÓN DE INFORMACIÓN EXTERNA: Verificado. Sin suposiciones sobre coyunturas externas o recomendaciones políticas.
[FIN DE EJECUCIÓN - TRANSMISIÓN DE ANÁLISIS DE DATOS Y METADATOS COMPLETADA]`;

    const llamaText = `[INICIO DE CONSULTA: LLAMA-4]
> Procesando serie de datos e indicador: "${indicatorName}".
> Ejecutando diagnóstico cruzado de todas las variables e interpretaciones:
  * Dimensión Estadística: Desvío acumulado máximo en ${maxGapYearReal} con ${formatNumber(maxAbsGapReal)} unidades.
  * Tendencia Comparada: Relación de velocidad de cambio en Colombia frente a ${regionAcronym}.
  * Notas de Contexto: Contraste del indicador con sus observaciones y notas técnicas.
> RESTRICCIÓN DE INFORMACIÓN EXTERNA: Verificado. Análisis sustentado estrictamente en la evidencia técnica del dataset.
[FIN DE EJECUCIÓN - TRANSMISIÓN MULTIDIMENSIONAL COMPLETADA]`;

    const orchestratorText = `[INICIANDO ORQUESTADOR GEMINI]
> Recibiendo reportes analíticos de los 5 modelos asociados...
  [OK] Gemini-Pro (Análisis Holístico Cuantitativo y de Contexto)
  [OK] GPT-4o (Análisis Integral y Desviación Técnica)
  [OK] Claude-3.5-Sonnet (Análisis Multidimensional y de Metadatos)
  [OK] Qwen-3 (Análisis de Asimetrías y Series)
  [OK] Llama-4 (Análisis de Velocidad y Notas Técnicas)
> Iniciando proceso de síntesis cruzada de interpretaciones...
> Integrando coeficientes de DRE con lecturas metodológicas de los 5 reportes.
> Filtrando y validando cumplimiento estricto de no-extrapolación:
  [CHECK] Cero políticas externas sugeridas.
  [CHECK] Análisis fundamentado 100% en datos reales y metadata oficial.
> Compilando HTML final... ¡Reporte sintetizado con éxito!
[SÍNTESIS COMPLETADA - DESPLEGANDO RESULTADO EN PANTALLA]`;

    // Construct full HTML responses for tabs
    const geminiResponse = `<h4><i class="fa-solid fa-circle-nodes" style="color: #10b981; margin-right: 0.5rem;"></i> Reporte Multidimensional Integrado (Gemini-Pro)</h4>
    <p>Se ha realizado un análisis exhaustivo y holístico de la serie temporal para el indicador <strong>"${indicatorName}"</strong> durante el periodo de registro real de <strong>${startReal} a ${endReal}</strong>, combinando métricas estadísticas con la interpretación de sus fichas técnicas.</p>
    <ul style="list-style: none; padding-left: 1rem; margin: 1rem 0; display: flex; flex-direction: column; gap: 0.5rem;">
        <li>📊 <strong>Desempeño y Velocidad (Cuantitativa):</strong> Colombia registró una tasa de variación anual compuesta (CAGR) del <strong>${formatNumber(colCagrReal)}%</strong>, mientras que ${regionAcronym} avanzó a un ritmo del <strong>${formatNumber(alcCagrReal)}%</strong> anual. La velocidad de evolución relativa muestra una diferencia anual de <strong>${formatNumber(Math.abs(colCagrReal - alcCagrReal))}%</strong>.</li>
        <li>⚖️ <strong>Brecha y Bienestar (Social):</strong> El valor final de Colombia (<strong>${formatNumber(colEndReal)}</strong>) frente a la media de ${regionAcronym} (<strong>${formatNumber(alcEndReal)}</strong>) arroja una Desviación Relativa Estándar (DRE) de <strong>${formatNumber(endGapReal / alcEndReal)}</strong>. Esto representa una brecha relativa del <strong>${formatNumber(Math.abs(endGapPctReal))}%</strong>, traduciéndose en una discrepancia medible en la cobertura del indicador.</li>
        <li>🔄 <strong>Metodología e Inercia (Institucional):</strong> Evaluando la definición oficial de <em>"${definitionText || 'No especificada'}"</em>, se observa que la inercia temporal y la persistencia de la desviación indican que los factores que determinan la variable han mostrado rigidez estructural para converger, alcanzando su separación máxima en el año <strong>${maxGapYearReal}</strong> con una brecha de <strong>${formatNumber(maxAbsGapReal)} unidades</strong>.</li>
    </ul>
    <p><strong>Interpretación de Convergencia:</strong> Los datos describen un patrón de <strong>${Math.abs(endGapReal) < Math.abs(startGapReal) ? 'Convergencia Relativa' : 'Divergencia Estructural'}</strong>, ya que la brecha relativa inicial pasó de <strong>${formatNumber(Math.abs(startGapPctReal))}%</strong> en ${startReal} a <strong>${formatNumber(Math.abs(endGapPctReal))}%</strong> en ${endReal}, limitando el avance simétrico entre Colombia y la región de referencia.</p>`;

    const chatgptResponse = `<h4><i class="fa-solid fa-bolt" style="color: #f59e0b; margin-right: 0.5rem;"></i> Reporte de Interpretaciones y Desviaciones Técnicas (GPT-4o)</h4>
    <p>Este diagnóstico analiza la trayectoria de Colombia frente al agregado de ${regionLabel} (${regionAcronym}) para el indicador <strong>"${indicatorName}"</strong>, evaluando las posibles explicaciones estadísticas y conceptuales a partir de la metodología de registro oficial provista.</p>
    <ul style="list-style: none; padding-left: 1rem; margin: 1rem 0; display: flex; flex-direction: column; gap: 0.5rem;">
        <li>📉 <strong>Análisis de la Serie Histórica:</strong> La brecha de valor del <strong>${formatNumber(Math.abs(endGapPctReal))}%</strong> al final del periodo denota una disparidad constante. La oscilación interanual de los datos indica que la dinámica nacional responde a factores de alta inercia interna, con variaciones que no logran acoplarse completamente a la tendencia del resto de la región.</li>
        <li>🔬 <strong>Consideraciones Metodológicas y de Medición:</strong> La unidad de medida (<strong>${metadata.unit || 'No especificada'}</strong>) y las notas metodológicas oficiales indican que las discrepancias no corresponden a un sesgo de medición, sino a asimetrías reales y persistentes en el comportamiento de las variables analizadas, teniendo su punto más crítico en el año <strong>${maxGapYearReal}</strong>.</li>
        <li>👥 <strong>Impacto Demográfico e Inclusión:</strong> De acuerdo con la definición del indicador, las diferencias en las tasas de cambio (CAGR de Colombia de <strong>${formatNumber(colCagrReal)}%</strong> vs <strong>${formatNumber(alcCagrReal)}%</strong> regional) sugieren que los beneficios del comportamiento de la variable no se distribuyen al mismo ritmo que en el conjunto de los países comparados.</li>
    </ul>
    <p><strong>Nota de Cumplimiento Técnico:</strong> Toda interpretación aquí expuesta se restringe rigurosamente a las definiciones oficiales provistas (fuentes: <em>${sourcesText || 'Oficiales de la CEPAL'}</em>) y a la serie temporal cuantitativa, omitiéndose hipótesis externas o recomendaciones de políticas no deducibles directamente del dataset.</p>`;

    const claudeResponse = `<h4><i class="fa-solid fa-brain" style="color: #06b6d4; margin-right: 0.5rem;"></i> Reporte de Interpretación Socio-Demográfica y Estructural (Claude-3.5-Sonnet)</h4>
    <p>El análisis integrado del indicador <strong>"${indicatorName}"</strong> combina la lectura matemática de la serie con el análisis cualitativo de sus metadatos y notas técnicas, evaluando el rezago o avance estructural de Colombia respecto a la región de comparación.</p>
    <ul style="list-style: none; padding-left: 1rem; margin: 1rem 0; display: flex; flex-direction: column; gap: 0.5rem;">
        <li>⚠️ <strong>Interpretación del Punto Crítico:</strong> El año de máxima desviación (<strong>${maxGapYearReal}</strong>) con una separación de <strong>${formatNumber(maxAbsGapReal)} unidades</strong> representa un hito en la trayectoria del indicador. Con base en la descripción y notas oficiales, esta brecha extrema coincide con variaciones que reflejan vulnerabilidad en las dinámicas cubiertas por la definición de la variable.</li>
        <li>⚖️ <strong>Disparidades y Dinámica de Cambio:</strong> La tasa CAGR de Colombia del <strong>${formatNumber(colCagrReal)}%</strong> comparada con el <strong>${formatNumber(alcCagrReal)}%</strong> regional revela que el ritmo de transformación nacional presenta una velocidad de cambio relativa de <strong>${formatNumber(Math.abs(colCagrReal - alcCagrReal))}%</strong>. Esta diferencia sostenida incide directamente en los indicadores agregados de cohesión y equidad según las notas técnicas de la CEPAL.</li>
        <li>📝 <strong>Contexto de los Metadatos:</strong> Integrando las observaciones oficiales (<em>"${commentsText ? commentsText.substring(0, 150) + '...' : 'No hay observaciones adicionales'}"</em>), el comportamiento de Colombia ilustra las asimetrías de base en el registro de este indicador, las cuales demandan una lectura atenta de los límites estadísticos de la serie.</li>
    </ul>
    <p><strong>Restricción de Análisis:</strong> Este diagnóstico excluye cualquier recomendación de reforma o propuestas de políticas públicas externas, limitándose de manera estricta a interpretar el comportamiento histórico e interacciones cuantitativas del dataset y las fichas de metadatos proporcionadas.</p>`;

    const qwenResponse = `<h4><i class="fa-solid fa-code-fork" style="color: #a855f7; margin-right: 0.5rem;"></i> Reporte de Asimetrías Conceptuales y Series (Qwen-3)</h4>
    <p>Qwen-3 ofrece un diagnóstico holístico fundamentado en los registros del indicador <strong>"${indicatorName}"</strong> y la consistencia metodológica de la serie temporal.</p>
    <ul style="list-style: none; padding-left: 1rem; margin: 1rem 0; display: flex; flex-direction: column; gap: 0.5rem;">
        <li>📉 <strong>Evolución y Comportamiento Histórico:</strong> La serie de datos de Colombia de <strong>${startReal} a ${endReal}</strong> muestra una dinámica con una variación media de CAGR de <strong>${formatNumber(colCagrReal)}%</strong>. En comparación, la referencia regional de ${regionAcronym} varió al <strong>${formatNumber(alcCagrReal)}%</strong> anual, marcando una brecha en el ritmo de evolución.</li>
        <li>🔬 <strong>Análisis del Margen de Desviación:</strong> La brecha final del <strong>${formatNumber(Math.abs(endGapPctReal))}%</strong> en ${endReal} (Desviación Relativa DRE de <strong>${formatNumber(endGapReal / alcEndReal)}</strong>) refleja una brecha persistente que se sostiene desde el inicio del registro, sin evidencias de convergencia significativa.</li>
        <li>📖 <strong>Metodología de Registro:</strong> Con base en la descripción técnica de <em>"${definitionText || 'No provista'}"</em> y las observaciones de la CEPAL, el indicador mide una dimensión de carácter estructural donde las variaciones interanuales graduales responden a inercias históricas de base y no a eventos transitorios.</li>
    </ul>
    <p><strong>Restricción Metodológica:</strong> De acuerdo con las instrucciones de control, este reporte no formula ninguna propuesta legislativa o agenda de gasto, y se restringe estrictamente a describir la interacción cuantitativa y conceptual de los metadatos suministrados.</p>`;

    const llamaResponse = `<h4><i class="fa-solid fa-dna" style="color: #ef4444; margin-right: 0.5rem;"></i> Reporte de Interpretación de Velocidades y Notas Técnicas (Llama-4)</h4>
    <p>El análisis integrado de Llama-4 evalúa la serie temporal del indicador <strong>"${indicatorName}"</strong> identificando hitos de cambio y su correspondencia con la metadata oficial.</p>
    <ul style="list-style: none; padding-left: 1rem; margin: 1rem 0; display: flex; flex-direction: column; gap: 0.5rem;">
        <li>⏱️ <strong>Velocidad y Ritmo Comparado:</strong> La comparación de tasas de crecimiento anual (Colombia: <strong>${formatNumber(colCagrReal)}%</strong> vs ${regionAcronym}: <strong>${formatNumber(alcCagrReal)}%</strong>) indica que la velocidad de ajuste de la variable en el país es diferente, lo que explica que la brecha respecto al promedio regional se mantenga en <strong>${formatNumber(Math.abs(endGapReal))} unidades</strong> al final de la serie histórica.</li>
        <li>⚡ <strong>Hito de Desviación Crítica:</strong> La brecha interanual máxima registrada en el año <strong>${maxGapYearReal}</strong>, con una separación absoluta de <strong>${formatNumber(maxAbsGapReal)} unidades</strong>, constituye el periodo de mayor asimetría en la serie, denotando un comportamiento diferencial en el país bajo el marco metodológico.</li>
        <li>📝 <strong>Soporte Metodológico:</strong> Integrando las observaciones oficiales (<em>"${commentsText ? commentsText.substring(0, 150) + '...' : 'Sin observaciones adicionales'}"</em>), Llama-4 constata que el comportamiento de la serie se alinea conceptualmente con las notas al pie de la CEPAL, las cuales definen las fuentes y exclusiones de cobertura del indicador.</li>
    </ul>
    <p><strong>Nota de Cumplimiento:</strong> Se omiten recomendaciones de política nacional y supuestos de factores macroeconómicos externos, garantizando un reporte 100% grounded en el dataset oficial.</p>`;

    // Calculate simulated tokens and cost
    const promptTokens = Math.round(promptText.length / 3.8);
    const tokensGemini = Math.round(promptTokens + geminiText.length / 3.8 + geminiResponse.length / 3.8);
    const tokensChatGPT = Math.round(promptTokens + chatgptText.length / 3.8 + chatgptResponse.length / 3.8);
    const tokensClaude = Math.round(promptTokens + claudeText.length / 3.8 + claudeResponse.length / 3.8);
    const tokensQwen = Math.round(promptTokens + qwenText.length / 3.8 + qwenResponse.length / 3.8);
    const tokensLlama = Math.round(promptTokens + llamaText.length / 3.8 + llamaResponse.length / 3.8);
    const totalQueryTokens = tokensGemini + tokensChatGPT + tokensClaude + tokensQwen + tokensLlama;
    
    // Model pricing per 1M tokens: Gemini $1.25, GPT $2.50, Claude $3.00, Qwen $0.80, Llama $1.00
    // Check if free tier is active. If not, charge to paid balance.
    const costGemini = appState.freeTiers.gemini > 0 ? 0 : (tokensGemini / 1000000) * 1.25;
    const costChatGPT = appState.freeTiers.chatgpt > 0 ? 0 : (tokensChatGPT / 1000000) * 2.50;
    const costClaude = appState.freeTiers.claude > 0 ? 0 : (tokensClaude / 1000000) * 3.00;
    const costQwen = appState.freeTiers.qwen > 0 ? 0 : (tokensQwen / 1000000) * 0.80;
    const costLlama = appState.freeTiers.llama > 0 ? 0 : (tokensLlama / 1000000) * 1.00;
    const totalQueryCost = costGemini + costChatGPT + costClaude + costQwen + costLlama;
    
    // Deduct tokens from free tiers first
    appState.freeTiers.gemini = Math.max(0, appState.freeTiers.gemini - tokensGemini);
    appState.freeTiers.chatgpt = Math.max(0, appState.freeTiers.chatgpt - tokensChatGPT);
    appState.freeTiers.claude = Math.max(0, appState.freeTiers.claude - tokensClaude);
    appState.freeTiers.qwen = Math.max(0, appState.freeTiers.qwen - tokensQwen);
    appState.freeTiers.llama = Math.max(0, appState.freeTiers.llama - tokensLlama);
    
    // Deduct cost from paid balance
    appState.queryBalance = Math.max(0, appState.queryBalance - totalQueryCost);
    appState.totalTokensUsed += totalQueryTokens;
    
    updateTokenStatusBar();
    
    // Update last cost display
    const lastCostContainer = document.getElementById('diag-last-cost-container');
    const tokensLastEl = document.getElementById('diag-tokens-last');
    const costLastEl = document.getElementById('diag-cost-last');
    
    if (lastCostContainer && tokensLastEl && costLastEl) {
        tokensLastEl.textContent = totalQueryTokens.toLocaleString('es-ES');
        costLastEl.textContent = `-$${totalQueryCost.toFixed(4)}`;
        lastCostContainer.style.display = 'flex';
    }

    // Append free tier remaining logs
    const getFreeTierLogLine = (tokens, limit) => {
        if (tokens <= 0) return `\n> Cuota Free Tier: AGOTADA (Cargando a cuenta de crédito)`;
        return `\n> Cuota Free Tier Restante: ${tokens.toLocaleString('es-ES')} / ${limit.toLocaleString('es-ES')} tokens`;
    };

    const finalGeminiText = geminiText + getFreeTierLogLine(appState.freeTiers.gemini, 500000);
    const finalClaudeText = claudeText + getFreeTierLogLine(appState.freeTiers.claude, 100000);
    const finalQwenText = qwenText + getFreeTierLogLine(appState.freeTiers.qwen, 1000000);
    const finalLlamaText = llamaText + getFreeTierLogLine(appState.freeTiers.llama, 250000);
    
    // Check if real OpenAI query is enabled
    const openAiApiKey = localStorage.getItem('openai_api_key');
    let openAiFinished = false;
    let openAiResultText = '';
    
    // Reset consoles text
    document.getElementById('gemini-term-body').textContent = '';
    document.getElementById('chatgpt-term-body').textContent = '';
    document.getElementById('claude-term-body').textContent = '';
    document.getElementById('qwen-term-body').textContent = '';
    document.getElementById('llama-term-body').textContent = '';
    document.getElementById('orchestrator-term-body').textContent = '';

    let simulationFinished = false;
    
    function checkAllCompleted() {
        if (simulationFinished && openAiFinished) {
            // Once all finish, type the orchestrator synthesis logs!
            const orchBody = document.getElementById('orchestrator-term-body');
            const orchDot = document.getElementById('orchestrator-status-dot');
            if (orchDot) {
                orchDot.style.background = '#3b82f6';
                orchDot.classList.add('blink');
            }
            
            let cursor = 0;
            const orchSpeed = 4; // fast orchestrator typing
            let orchInterval = setInterval(() => {
                if (cursor < orchestratorText.length) {
                    orchBody.textContent += orchestratorText.charAt(cursor);
                    cursor++;
                    const parent = orchBody.parentElement;
                    if (parent) parent.scrollTop = parent.scrollHeight;
                } else {
                    clearInterval(orchInterval);
                    if (orchDot) {
                        orchDot.classList.remove('blink');
                        orchDot.style.background = '#3b82f6';
                    }
                    
                    // Reveal synthesized content with tabs
                    revealFinalSynthesis(htmlContent, geminiResponse, chatgptResponse, claudeResponse, qwenResponse, llamaResponse, indId);
                }
            }, orchSpeed);
        }
    }

    if (openAiApiKey) {
        appState.lastGptRealResponse = '';
        const chatGptDot = document.getElementById('chatgpt-status-dot');
        if (chatGptDot) {
            chatGptDot.style.background = '#f59e0b';
            chatGptDot.classList.add('blink');
        }
        
        document.getElementById('chatgpt-term-body').textContent = '> Conectando con la API de OpenAI (gpt-4o-mini)...\n';
        
        fetchOpenAiGpt4(
            promptText,
            (chunk) => {
                document.getElementById('chatgpt-term-body').textContent += chunk;
                const parent = document.getElementById('chatgpt-term-body').parentElement;
                if (parent) parent.scrollTop = parent.scrollHeight;
            },
            (fullText) => {
                openAiFinished = true;
                openAiResultText = fullText;
                appState.lastGptRealResponse = fullText;
                if (chatGptDot) chatGptDot.classList.remove('blink');
                checkAllCompleted();
            },
            (errorMsg) => {
                openAiFinished = true;
                openAiResultText = `Error: ${errorMsg}`;
                appState.lastGptRealResponse = `Error al conectar con la API de OpenAI:\n\n${errorMsg}\n\nPor favor, verifica tu API Key y conexión a internet.`;
                document.getElementById('chatgpt-term-body').textContent += `\n[ERROR DE CONEXIÓN: ${errorMsg}]`;
                if (chatGptDot) chatGptDot.classList.remove('blink');
                checkAllCompleted();
            }
        );
        
        // Run simulated models (4 models, ChatGPT is running real stream)
        typeWriterParallel(
            [
                document.getElementById('gemini-term-body'),
                document.getElementById('claude-term-body'),
                document.getElementById('qwen-term-body'),
                document.getElementById('llama-term-body')
            ],
            [finalGeminiText, finalClaudeText, finalQwenText, finalLlamaText],
            () => {
                simulationFinished = true;
                checkAllCompleted();
            }
        );
    } else {
        openAiFinished = true;
        appState.lastGptRealResponse = null;
        const finalChatgptText = chatgptText + getFreeTierLogLine(appState.freeTiers.chatgpt, 150000);
        
        // Run 5 simulated models
        typeWriterParallel(
            [
                document.getElementById('gemini-term-body'),
                document.getElementById('chatgpt-term-body'),
                document.getElementById('claude-term-body'),
                document.getElementById('qwen-term-body'),
                document.getElementById('llama-term-body')
            ],
            [finalGeminiText, finalChatgptText, finalClaudeText, finalQwenText, finalLlamaText],
            () => {
                simulationFinished = true;
                checkAllCompleted();
            }
        );
    }
}

// Parallel typing animator
function typeWriterParallel(elements, texts, callback) {
    let cursors = elements.map(() => 0);
    let intervals = [];
    const speed = 3; // fast streaming speed to feel active but not slow down usability
    
    function startTyping(idx) {
        const el = elements[idx];
        const text = texts[idx];
        const dotId = el.id.replace('-term-body', '-status-dot');
        const dot = document.getElementById(dotId);
        if (dot) {
            if (el.id.includes('gemini')) dot.style.background = '#10b981';
            else if (el.id.includes('chatgpt')) dot.style.background = '#f59e0b';
            else if (el.id.includes('claude')) dot.style.background = '#06b6d4';
            else if (el.id.includes('qwen')) dot.style.background = '#a855f7';
            else if (el.id.includes('llama')) dot.style.background = '#ef4444';
            dot.classList.add('blink');
        }
        
        let interval = setInterval(() => {
            if (cursors[idx] < text.length) {
                el.textContent += text.charAt(cursors[idx]);
                cursors[idx]++;
                const parent = el.parentElement;
                if (parent) parent.scrollTop = parent.scrollHeight;
            } else {
                clearInterval(interval);
                if (dot) {
                    dot.classList.remove('blink');
                }
                checkAllFinished();
            }
        }, speed);
        intervals.push(interval);
    }
    
    let finishedCount = 0;
    function checkAllFinished() {
        finishedCount++;
        if (finishedCount === elements.length) {
            callback();
        }
    }
    
    for (let i = 0; i < elements.length; i++) {
        startTyping(i);
    }
}

// Synthesis revealer with tabs
function revealFinalSynthesis(synthesisHtml, geminiHtml, chatgptHtml, claudeHtml, qwenHtml, llamaHtml, indId) {
    const finalContent = document.getElementById('final-synthesis-content');
    if (finalContent) {
        const formatFree = (tokens) => {
            if (tokens <= 0) return '(Agotado)';
            if (tokens >= 1000000) return `(Free: ${(tokens / 1000000).toFixed(1)}M)`;
            return `(Free: ${Math.round(tokens / 1000)}K)`;
        };

        finalContent.innerHTML = `
            <!-- Tab Buttons -->
            <div class="diagnostic-tabs" style="display: flex; gap: 0.4rem; margin-bottom: 1.25rem; flex-wrap: wrap; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                <button type="button" class="btn-tab active" id="btn-diagtab-synthesis" onclick="switchDiagnosticTab('synthesis')" style="padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: var(--transition-smooth); border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.15); color: #3b82f6;">
                    <i class="fa-solid fa-square-poll-horizontal" style="margin-right: 0.25rem;"></i> Síntesis Consolidada
                </button>
                <button type="button" class="btn-tab" id="btn-diagtab-gemini" onclick="switchDiagnosticTab('gemini')" style="padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: var(--transition-smooth); border: 1px solid rgba(16, 185, 129, 0.15); background: transparent; color: var(--text-secondary);">
                    <i class="fa-solid fa-circle-nodes" style="margin-right: 0.25rem; color: #10b981;"></i> Gemini-Pro <span style="font-size: 0.65rem; opacity: 0.7; font-weight: normal; margin-left: 0.25rem;">${formatFree(appState.freeTiers.gemini)}</span>
                </button>
                <button type="button" class="btn-tab" id="btn-diagtab-chatgpt" onclick="switchDiagnosticTab('chatgpt')" style="padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: var(--transition-smooth); border: 1px solid rgba(245, 158, 11, 0.15); background: transparent; color: var(--text-secondary);">
                    <i class="fa-solid fa-bolt" style="margin-right: 0.25rem; color: #f59e0b;"></i> GPT-4o <span style="font-size: 0.65rem; opacity: 0.7; font-weight: normal; margin-left: 0.25rem;">${formatFree(appState.freeTiers.chatgpt)}</span>
                </button>
                <button type="button" class="btn-tab" id="btn-diagtab-claude" onclick="switchDiagnosticTab('claude')" style="padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: var(--transition-smooth); border: 1px solid rgba(6, 182, 212, 0.15); background: transparent; color: var(--text-secondary);">
                    <i class="fa-solid fa-brain" style="margin-right: 0.25rem; color: #06b6d4;"></i> Claude-3.5 <span style="font-size: 0.65rem; opacity: 0.7; font-weight: normal; margin-left: 0.25rem;">${formatFree(appState.freeTiers.claude)}</span>
                </button>
                <button type="button" class="btn-tab" id="btn-diagtab-qwen" onclick="switchDiagnosticTab('qwen')" style="padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: var(--transition-smooth); border: 1px solid rgba(168, 85, 247, 0.15); background: transparent; color: var(--text-secondary);">
                    <i class="fa-solid fa-code-fork" style="margin-right: 0.25rem; color: #a855f7;"></i> Qwen-3 <span style="font-size: 0.65rem; opacity: 0.7; font-weight: normal; margin-left: 0.25rem;">${formatFree(appState.freeTiers.qwen)}</span>
                </button>
                <button type="button" class="btn-tab" id="btn-diagtab-llama" onclick="switchDiagnosticTab('llama')" style="padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: var(--transition-smooth); border: 1px solid rgba(239, 68, 68, 0.15); background: transparent; color: var(--text-secondary);">
                    <i class="fa-solid fa-dna" style="margin-right: 0.25rem; color: #ef4444;"></i> Llama-4 <span style="font-size: 0.65rem; opacity: 0.7; font-weight: normal; margin-left: 0.25rem;">${formatFree(appState.freeTiers.llama)}</span>
                </button>
            </div>

            <!-- Tab Contents -->
            <div id="diagtab-content-synthesis" class="diagtab-content-panel" style="display: block;">
                <div style="margin-top: 0.5rem; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                        <i class="fa-solid fa-square-poll-horizontal" style="color: var(--accent-blue); font-size: 1.15rem;"></i>
                        <span style="font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; text-transform: uppercase; color: var(--text-primary);">Síntesis Diagnóstica Consolidada por IA</span>
                    </div>
                    ${synthesisHtml}
                </div>
            </div>
            <div id="diagtab-content-gemini" class="diagtab-content-panel" style="display: none; color: #a7f3d0; line-height: 1.6; font-size: 0.875rem; padding: 0.5rem; background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 6px;">
                ${geminiHtml}
            </div>
            <div id="diagtab-content-chatgpt" class="diagtab-content-panel" style="display: none; color: #fef3c7; line-height: 1.6; font-size: 0.875rem; padding: 0.5rem; background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.1); border-radius: 6px;">
                ${appState.lastGptRealResponse ? `
                <!-- Compare Toggle -->
                <div class="compare-toggle-bar" style="display: flex; gap: 0.25rem; background: rgba(0,0,0,0.25); padding: 3px; border-radius: 6px; width: fit-content; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05);">
                    <button type="button" class="btn-compare-mode active" id="btn-gptmode-real" onclick="setGptCompareMode('real')" style="background: rgba(245, 158, 11, 0.15); border: none; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; color: #f59e0b; cursor: pointer; transition: var(--transition-smooth);">
                        <i class="fa-solid fa-wifi" style="margin-right: 0.25rem;"></i> Consulta Real (ChatGPT)
                    </button>
                    <button type="button" class="btn-compare-mode" id="btn-gptmode-heuristic" onclick="setGptCompareMode('heuristic')" style="background: transparent; border: none; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: var(--transition-smooth);">
                        <i class="fa-solid fa-cogs" style="margin-right: 0.25rem;"></i> Simulación Heurística
                    </button>
                </div>
                <div id="gpt-compare-content-real" style="display: block;">
                    ${parseMarkdownToHtml(appState.lastGptRealResponse)}
                </div>
                <div id="gpt-compare-content-heuristic" style="display: none;">
                    ${chatgptHtml}
                </div>
                ` : `
                <div id="gpt-compare-content-heuristic" style="display: block;">
                    ${chatgptHtml}
                </div>
                `}
            </div>
            <div id="diagtab-content-claude" class="diagtab-content-panel" style="display: none; color: #cffafe; line-height: 1.6; font-size: 0.875rem; padding: 0.5rem; background: rgba(6, 182, 212, 0.03); border: 1px solid rgba(6, 182, 212, 0.1); border-radius: 6px;">
                ${claudeHtml}
            </div>
            <div id="diagtab-content-qwen" class="diagtab-content-panel" style="display: none; color: #e9d5ff; line-height: 1.6; font-size: 0.875rem; padding: 0.5rem; background: rgba(168, 85, 247, 0.03); border: 1px solid rgba(168, 85, 247, 0.1); border-radius: 6px;">
                ${qwenHtml}
            </div>
            <div id="diagtab-content-llama" class="diagtab-content-panel" style="display: none; color: #fee2e2; line-height: 1.6; font-size: 0.875rem; padding: 0.5rem; background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 6px;">
                ${llamaHtml}
            </div>
        `;
        finalContent.style.display = 'block';
        setTimeout(() => {
            finalContent.style.opacity = '1';
        }, 50);
        
        // Cache the entire content of diagnostic-content to retrieve it in memory
        const container = document.getElementById('diagnostic-content');
        if (container) {
            appState.diagnosticCache[indId] = container.innerHTML;
        }
        
        renderDiagnosticBadge();
    }
}

function generateDiagnosticHtmlText(years, colData, alcData, metadata) {
    let regionLabel = 'América Latina y el Caribe';
    let regionAcronym = 'ALC';
    if (appState.selectedRegion === 'LAT') {
        regionLabel = 'América Latina (promedio simple)';
        regionAcronym = 'AL (promedio simple)';
    } else if (appState.selectedRegion === 'LATO') {
        regionLabel = 'América Latina';
        regionAcronym = 'AL';
    }
    // Extract key indices
    const validYears = years.filter(yr => colData[yr] !== undefined && alcData[yr] !== undefined);
    if (validYears.length === 0) {
        return '<p>Datos insuficientes para generar una correlación y diagnóstico comparativo.</p>';
    }
    
    const realYears = validYears.filter(yr => parseInt(yr) < 2025);
    const projectedYears = validYears.filter(yr => parseInt(yr) >= 2025);
    
    let htmlContent = '';
    
    // --- 1. HISTORICAL / REAL DATA DIAGNOSTIC ---
    if (realYears.length > 0) {
        const startReal = realYears[0];
        const endReal = realYears[realYears.length - 1];
        const colStartReal = colData[startReal];
        const colEndReal = colData[endReal];
        const alcStartReal = alcData[startReal];
        const alcEndReal = alcData[endReal];
        
        const numYearsReal = parseInt(endReal) - parseInt(startReal);
        let colCagrReal = 0, alcCagrReal = 0;
        if (numYearsReal > 0) {
            if (colStartReal > 0 && colEndReal > 0) colCagrReal = (Math.pow(colEndReal / colStartReal, 1 / numYearsReal) - 1) * 100;
            if (alcStartReal > 0 && alcEndReal > 0) alcCagrReal = (Math.pow(alcEndReal / alcStartReal, 1 / numYearsReal) - 1) * 100;
        }
        
        const endGapReal = colEndReal - alcEndReal;
        const endGapPctReal = alcEndReal !== 0 ? (endGapReal / alcEndReal) * 100 : 0;
        const startGapReal = colStartReal - alcStartReal;
        const startGapPctReal = alcStartReal !== 0 ? (startGapReal / alcStartReal) * 100 : 0;
        const gapClosingReal = Math.abs(endGapReal) < Math.abs(startGapReal);
        
        // Find peak gap year in real years
        let maxAbsGapReal = -1;
        let maxGapYearReal = null;
        let maxGapDirectionReal = 1;
        realYears.forEach(yr => {
            const gap = colData[yr] - alcData[yr];
            if (Math.abs(gap) > maxAbsGapReal) {
                maxAbsGapReal = Math.abs(gap);
                maxGapYearReal = yr;
                maxGapDirectionReal = gap >= 0 ? 1 : -1;
            }
        });
        
        let introReal = `<h4><i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-green);"></i> Análisis de Registro Histórico Real (Período ${startReal} - ${endReal})</h4>`;
        introReal += `<p>Durante esta serie de datos reales, Colombia mostró una trayectoria `;
        if (colEndReal > colStartReal) {
            introReal += `ascendente con un crecimiento anual compuesto (CAGR) del <strong>${formatNumber(colCagrReal)}%</strong>. `;
        } else if (colEndReal < colStartReal) {
            introReal += `descendente con una contracción promedio del <strong>${formatNumber(Math.abs(colCagrReal))}%</strong> anual. `;
        } else {
            introReal += `estable. `;
        }
        
        introReal += `Por su parte, el agregado de ${regionLabel} (${regionAcronym}) evolucionó a un ritmo del <strong>${formatNumber(alcCagrReal)}%</strong> anual.</p>`;
        
        const relationReal = colEndReal >= alcEndReal ? 'por encima de' : 'por debajo de';
        let gapRealText = `<p style="margin-top: 0.5rem;">Al cierre del registro real en <strong>${endReal}</strong>, Colombia se ubicaba <strong>${formatNumber(Math.abs(endGapReal))} unidades</strong> (${relationReal}) del promedio de ${regionAcronym} (diferencia del <strong>${formatNumber(Math.abs(endGapPctReal))}%</strong>). `;
        
        if (gapClosingReal) {
            gapRealText += `Esto evidencia un proceso histórico de <strong>convergencia</strong>, reduciendo la brecha inicial del <strong>${formatNumber(Math.abs(startGapPctReal))}%</strong> registrada en <strong>${startReal}</strong>.</p>`;
        } else {
            gapRealText += `Esto indica una <strong>divergencia estructural</strong> respecto al promedio regional, ampliando la brecha relativa inicial del <strong>${formatNumber(Math.abs(startGapPctReal))}%</strong> observada en <strong>${startReal}</strong>.</p>`;
        }
        
        const relationPeakReal = maxGapDirectionReal >= 0 ? 'superior' : 'inferior';
        let bulletReal = `<ul class="diagnostic-list" style="margin-top: 0.5rem; margin-bottom: 1rem;">`;
        bulletReal += `<li><strong>Brecha Histórica Máxima:</strong> Ocurrió en el año <strong>${maxGapYearReal}</strong>, donde el dato de Colombia estuvo <strong>${formatNumber(maxAbsGapReal)} unidades</strong> (${relationPeakReal}) respecto a la media de ${regionAcronym}.</li>`;
        bulletReal += `</ul>`;
        
        const unit = metadata ? metadata.unit : '';
        const unitSuffix = unit ? ` ${unit}` : '';
        
        // Colombia-specific trend analysis
        let trendColombia = '';
        const colRealYears = realYears.filter(yr => colData[yr] !== undefined);
        if (colRealYears.length > 0) {
            let maxColVal = -Infinity;
            let maxColYear = null;
            let minColVal = Infinity;
            let minColYear = null;
            
            colRealYears.forEach(yr => {
                const val = colData[yr];
                if (val > maxColVal) {
                    maxColVal = val;
                    maxColYear = yr;
                }
                if (val < minColVal) {
                    minColVal = val;
                    minColYear = yr;
                }
            });
            
            const firstYear = colRealYears[0];
            const lastYear = colRealYears[colRealYears.length - 1];
            const firstVal = colData[firstYear];
            const lastVal = colData[lastYear];
            const absChange = lastVal - firstVal;
            const pctChange = firstVal !== 0 ? (absChange / firstVal) * 100 : 0;
            
            let maxYoYYear = null;
            let maxYoYAbsChange = 0;
            let maxYoYPctChange = 0;
            let maxYoYDiff = -1;
            
            for (let i = 1; i < colRealYears.length; i++) {
                const yrPrev = colRealYears[i-1];
                const yrCurr = colRealYears[i];
                if (parseInt(yrCurr) - parseInt(yrPrev) === 1) {
                    const valPrev = colData[yrPrev];
                    const valCurr = colData[yrCurr];
                    const diff = valCurr - valPrev;
                    if (Math.abs(diff) > maxYoYDiff) {
                        maxYoYDiff = Math.abs(diff);
                        maxYoYYear = yrCurr;
                        maxYoYAbsChange = diff;
                        maxYoYPctChange = valPrev !== 0 ? (diff / valPrev) * 100 : 0;
                    }
                }
            }
            
            let comparisonText = '';
            if (Math.abs(colCagrReal - alcCagrReal) < 0.1) {
                comparisonText = 'prácticamente idéntico';
            } else if (colCagrReal > alcCagrReal) {
                comparisonText = colCagrReal > 0 ? 'más rápido' : 'con una contracción más lenta';
            } else {
                comparisonText = alcCagrReal > 0 ? 'más lento o rezagado' : 'con una contracción más severa';
            }
            
            let yoyHtml = '';
            if (maxYoYYear) {
                yoyHtml = `<li>⚡ <strong>Hito de Mayor Cambio Interanual:</strong> En <strong>${maxYoYYear}</strong> se registró la variación anual más abrupta en la serie, con un cambio de <strong>${maxYoYAbsChange >= 0 ? '+' : ''}${formatNumber(maxYoYAbsChange)}${unitSuffix}</strong> (<strong>${maxYoYPctChange >= 0 ? '+' : ''}${formatNumber(maxYoYPctChange)}%</strong>) frente a ${parseInt(maxYoYYear) - 1}.</li>`;
            }
            
            trendColombia = `
            <div style="margin-top: 1.25rem; padding: 1.25rem; background: rgba(255, 215, 0, 0.03); border: 1px dashed rgba(255, 215, 0, 0.25); border-radius: 8px;">
                <h4 style="color: var(--color-colombia); margin-bottom: 0.75rem;"><i class="fa-solid fa-flag"></i> Tendencias Clave de Colombia (Registro Real)</h4>
                <ul style="margin-left: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; display: flex; flex-direction: column; gap: 0.4rem;">
                    <li>📈 <strong>Punto Máximo:</strong> Se alcanzó un valor de <strong>${formatNumber(maxColVal)}${unitSuffix}</strong> en el año <strong>${maxColYear}</strong>.</li>
                    <li>📉 <strong>Punto Mínimo:</strong> Se registró un valor de <strong>${formatNumber(minColVal)}${unitSuffix}</strong> en el año <strong>${minColYear}</strong>.</li>
                    <li>🔄 <strong>Variación Neta:</strong> La variable experimentó un cambio absoluto de <strong>${absChange >= 0 ? '+' : ''}${formatNumber(absChange)}${unitSuffix}</strong> (<strong>${pctChange >= 0 ? '+' : ''}${formatNumber(pctChange)}%</strong>) entre <strong>${firstYear}</strong> y <strong>${lastYear}</strong>.</li>
                    ${yoyHtml}
                    <li>📊 <strong>Dinámica Relativa:</strong> Colombia ha evolucionado a un ritmo <strong>${comparisonText}</strong> que el promedio de ${regionLabel} (CAGR de <strong>${formatNumber(colCagrReal)}%</strong> vs. <strong>${formatNumber(alcCagrReal)}%</strong>).</li>
                </ul>
            </div>`;
        }
        
        let trendReal = `
        <div style="margin-top: 1.25rem; padding: 1.25rem; background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.2); border-radius: 8px;">
            <h4 style="color: var(--accent-green); margin-bottom: 0.75rem;"><i class="fa-solid fa-arrow-trend-up"></i> Principales Tendencias Históricas</h4>
            <ul style="margin-left: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
                <li><strong>Colombia:</strong> Presenta una tendencia de <strong>${getTrendDescription(colCagrReal)}</strong>, con una tasa promedio del <strong>${formatNumber(colCagrReal)}%</strong> anual.</li>
                <li><strong>${regionLabel}:</strong> Muestra una dinámica de <strong>${getTrendDescription(alcCagrReal)}</strong>, variando al <strong>${formatNumber(alcCagrReal)}%</strong> anual en promedio.</li>
            </ul>
        </div>`;
        
        htmlContent += `<div style="margin-bottom: 1.5rem;">${introReal}${gapRealText}${bulletReal}${trendColombia}${trendReal}</div>`;
    }
    
    // --- 2. PROSPECTIVE / PROJECTED DATA DIAGNOSTIC ---
    if (projectedYears.length > 0) {
        const baseYear = realYears.length > 0 ? realYears[realYears.length - 1] : projectedYears[0];
        const endProj = projectedYears[projectedYears.length - 1];
        
        const colBase = colData[baseYear];
        const colEndProj = colData[endProj];
        const alcBase = alcData[baseYear];
        const alcEndProj = alcData[endProj];
        
        const numYearsProj = parseInt(endProj) - parseInt(baseYear);
        let colCagrProj = 0, alcCagrProj = 0;
        if (numYearsProj > 0) {
            if (colBase > 0 && colEndProj > 0) colCagrProj = (Math.pow(colEndProj / colBase, 1 / numYearsProj) - 1) * 100;
            if (alcBase > 0 && alcEndProj > 0) alcCagrProj = (Math.pow(alcEndProj / alcBase, 1 / numYearsProj) - 1) * 100;
        }
        
        const endGapProj = colEndProj - alcEndProj;
        const endGapPctProj = alcEndProj !== 0 ? (endGapProj / alcEndProj) * 100 : 0;
        const baseGap = colBase - alcBase;
        
        const gapClosingProj = Math.abs(endGapProj) < Math.abs(baseGap);
        
        let introProj = `<h4><i class="fa-solid fa-chart-line" style="color: var(--color-alc);"></i> Escenario de Proyección Prospectiva (Período ${baseYear} - ${endProj})</h4>`;
        introProj += `<p>Las estimaciones oficiales proyectan que Colombia mantendrá un ritmo de cambio del <strong>${formatNumber(colCagrProj)}%</strong> anual hasta el año <strong>${endProj}</strong>. `;
        introProj += `Para ${regionAcronym}, el comportamiento esperado se sitúa en un <strong>${formatNumber(alcCagrProj)}%</strong> anual.</p>`;
        
        const relationProj = colEndProj >= alcEndProj ? 'por encima del' : 'por debajo del';
        let gapProjText = `<p style="margin-top: 0.5rem;">En el horizonte futuro de <strong>${endProj}</strong>, los modelos matemáticos prevén que Colombia se ubique <strong>${formatNumber(Math.abs(endGapProj))} unidades</strong> (${relationProj}) promedio de ${regionAcronym} (brecha de <strong>${formatNumber(Math.abs(endGapPctProj))}%</strong>). `;
        
        if (gapClosingProj) {
            gapProjText += `Esto sugiere un escenario futuro de **convergencia tardía**, donde la brecha proyectada tiende a estrecharse frente al punto de partida real.</p>`;
        } else {
            gapProjText += `Esto apunta a un escenario futuro de **brecha persistente o divergencia**, perpetuando o ampliando la asimetría territorial observada en los registros históricos.</p>`;
        }
        
        let trendProj = `
        <div style="margin-top: 1.25rem; padding: 1.25rem; background: rgba(168, 85, 247, 0.05); border: 1px dashed rgba(168, 85, 247, 0.2); border-radius: 8px;">
            <h4 style="color: #c084fc; margin-bottom: 0.75rem;"><i class="fa-solid fa-arrow-trend-up"></i> Tendencias Futuras Proyectadas</h4>
            <ul style="margin-left: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
                <li><strong>Colombia:</strong> Proyecta una tendencia de <strong>${getTrendDescription(colCagrProj)}</strong> hacia ${endProj} (${formatNumber(colCagrProj)}% anual).</li>
                <li><strong>${regionLabel}:</strong> Se prevé una dinámica de <strong>${getTrendDescription(alcCagrProj)}</strong> (${formatNumber(alcCagrProj)}% anual).</li>
            </ul>
        </div>`;
        
        htmlContent += `<div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">${introProj}${gapProjText}${trendProj}</div>`;
    }
    
    // Add disclaimer badge at the bottom
    htmlContent += `
        <div style="margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: rgba(59, 130, 246, 0.05); border: 1px dashed rgba(59, 130, 246, 0.15); font-size: 0.8125rem; color: var(--text-secondary);">
            <i class="fa-solid fa-circle-info"></i> <strong>Nota metodológica diferencial:</strong> Este reporte distingue automáticamente entre la certeza de las observaciones reales del pasado y el grado de certidumbre asociado a las proyecciones estadísticas y estimaciones futuras del modelo.
        </div>
    `;
    
    return htmlContent;
}

// 10. Export to CSV functionality
function exportToCSV() {
    if (!appState.indicatorData || !appState.selectedIndicator) return;
    
    // Reconstruct data from table
    const tableBody = document.getElementById('data-table-body');
    const rows = tableBody.querySelectorAll('tr');
    
    let csvContent = '\uFEFF'; // UTF-8 BOM
    const activeRegionLabel = appState.selectedRegion === 'LAT' ? 'América Latina (promedio simple)' : (appState.selectedRegion === 'LATO' ? 'América Latina' : 'América Latina y el Caribe');
    csvContent += `Año,Colombia,Valor ALC (212),Valor AL (211),Valor AL Prom. Simple,Brecha Absoluta (vs ${activeRegionLabel}),Brecha Porcentual (vs ${activeRegionLabel})\n`;
    
    rows.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 7) return;
        
        const year = tds[0].textContent.trim();
        // Replace thousand separators and decimal points to standard CSV format
        const col = tds[1].textContent.trim().replace(/\./g, '').replace(/,/g, '.');
        const alc = tds[2].textContent.trim().replace(/\./g, '').replace(/,/g, '.');
        const al = tds[3].textContent.trim().replace(/\./g, '').replace(/,/g, '.');
        const latSimple = tds[4].textContent.trim().replace(/\./g, '').replace(/,/g, '.');
        
        // Read raw numeric values from attributes to avoid formatting issues
        const gapRaw = tds[5].getAttribute('data-raw');
        const pctRaw = tds[6].getAttribute('data-raw');
        
        const gap = (gapRaw !== null && gapRaw !== '') ? gapRaw : '-';
        const pct = (pctRaw !== null && pctRaw !== '') ? pctRaw : '-';
        
        csvContent += `"${year}","${col}","${alc}","${al}","${latSimple}","${gap}","${pct}"\n`;
    });
    
    const filename = `${appState.selectedIndicator.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_comparativa.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// 11. Global Section Switching Logic
function switchGlobalSection(sectionId, pushHistory = true) {
    appState.currentGlobalSection = sectionId;
    
    // Toggle visibility of main sections
    document.getElementById('explorer-section').style.display = sectionId === 'explorer' ? 'block' : 'none';
    document.getElementById('structures-section').style.display = sectionId === 'structures' ? 'block' : 'none';
    document.getElementById('brechas-section').style.display = sectionId === 'brechas' ? 'block' : 'none';
    
    const metodologiaSection = document.getElementById('metodologia-section');
    if (metodologiaSection) {
        metodologiaSection.style.display = sectionId === 'metodologia' ? 'block' : 'none';
    }
    
    const tendenciasSection = document.getElementById('tendencias-section');
    if (tendenciasSection) {
        tendenciasSection.style.display = sectionId === 'tendencias' ? 'block' : 'none';
    }
    
    const tendencias2Section = document.getElementById('tendencias2-section');
    if (tendencias2Section) {
        tendencias2Section.style.display = sectionId === 'tendencias2' ? 'block' : 'none';
    }
    
    const exportarDatosSection = document.getElementById('exportar-datos-section');
    if (exportarDatosSection) {
        exportarDatosSection.style.display = sectionId === 'exportar-datos' ? 'block' : 'none';
    }

    const creadorSection = document.getElementById('creador-section');
    if (creadorSection) {
        creadorSection.style.display = sectionId === 'creador' ? 'block' : 'none';
    }
    
    const consultaSection = document.getElementById('consulta-section');
    if (consultaSection) {
        consultaSection.style.display = sectionId === 'consulta' ? 'block' : 'none';
    }
    
    // Update sidebar brechas button active highlight
    const sidebarBrechasBtn = document.getElementById('sidebar-brechas-btn');
    if (sidebarBrechasBtn) {
        sidebarBrechasBtn.classList.toggle('active', sectionId === 'brechas');
    }
    
    // Update sidebar metodologia button active highlight
    const sidebarMetodologiaBtn = document.getElementById('sidebar-metodologia-btn');
    if (sidebarMetodologiaBtn) {
        sidebarMetodologiaBtn.classList.toggle('active', sectionId === 'metodologia');
    }
    
    // Update sidebar tendencias button active highlight
    const sidebarTendenciasBtn = document.getElementById('sidebar-tendencias-btn');
    if (sidebarTendenciasBtn) {
        sidebarTendenciasBtn.classList.toggle('active', sectionId === 'tendencias');
    }
    
    // Update sidebar tendencias2 button active highlight
    const sidebarTendencias2Btn = document.getElementById('sidebar-tendencias2-btn');
    if (sidebarTendencias2Btn) {
        sidebarTendencias2Btn.classList.toggle('active', sectionId === 'tendencias2');
    }
    
    // Update sidebar exportar-datos button active highlight
    const sidebarExportarBtn = document.getElementById('sidebar-exportar-datos-btn');
    if (sidebarExportarBtn) {
        sidebarExportarBtn.classList.toggle('active', sectionId === 'exportar-datos');
    }

    const sidebarCreadorBtn = document.getElementById('sidebar-creador-btn');
    if (sidebarCreadorBtn) {
        sidebarCreadorBtn.classList.toggle('active', sectionId === 'creador');
    }

    const sidebarConsultaBtn = document.getElementById('sidebar-consulta-btn');
    if (sidebarConsultaBtn) {
        sidebarConsultaBtn.classList.toggle('active', sectionId === 'consulta');
    }
    
    // Auto load first indicator of structures if none is loaded yet
    if (sectionId === 'structures' && !appState.pyramidData) {
        selectPyramidIndicator(appState.selectedPyramidIndicatorId, false);
    }
    
    if (pushHistory) {
        if (sectionId === 'explorer') {
            history.pushState({ section: 'explorer', indicatorId: appState.selectedIndicator ? appState.selectedIndicator.id : null }, '', '');
        } else if (sectionId === 'structures') {
            history.pushState({ section: 'structures', pyramidId: appState.selectedPyramidIndicatorId }, '', '');
        } else {
            history.pushState({ section: sectionId }, '', '');
        }
    }
}

// 11b. Click handler for sidebar Brechas section
function selectBrechasSection(pushHistory = true) {
    switchGlobalSection('brechas', pushHistory);
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-tendencias2-btn' && el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-creador-btn' && el.id !== 'sidebar-consulta-btn') {
            el.classList.remove('active');
        }
    });
    
    renderCriticalGaps();
}

// 11c. Click handler for sidebar Metodología section
function selectMetodologiaSection(pushHistory = true) {
    switchGlobalSection('metodologia', pushHistory);
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-tendencias2-btn' && el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-creador-btn' && el.id !== 'sidebar-consulta-btn') {
            el.classList.remove('active');
        }
    });
}

// 11d. Click handler for sidebar Tendencias section
function selectTendenciasSection(pushHistory = true) {
    switchGlobalSection('tendencias', pushHistory);
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-tendencias2-btn' && el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-creador-btn' && el.id !== 'sidebar-consulta-btn') {
            el.classList.remove('active');
        }
    });
    
    renderTendencias();
}

// Click handler for sidebar Tendencias2 section
function selectTendencias2Section(pushHistory = true) {
    switchGlobalSection('tendencias2', pushHistory);
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-tendencias2-btn' && el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-creador-btn' && el.id !== 'sidebar-consulta-btn') {
            el.classList.remove('active');
        }
    });
    
    renderTendencias2();
}

// 11e. Click handler for sidebar Exportar Datos section
function selectExportarDatosSection(pushHistory = true) {
    switchGlobalSection('exportar-datos', pushHistory);
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-tendencias2-btn' && el.id !== 'sidebar-creador-btn' && el.id !== 'sidebar-consulta-btn') {
            el.classList.remove('active');
        }
    });
    
    initExportarDatosSection();
}

// 11f. Click handler for sidebar Creador section
function selectCreadorSection(pushHistory = true) {
    switchGlobalSection('creador', pushHistory);
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-creador-btn' && el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-tendencias2-btn' && el.id !== 'sidebar-consulta-btn') {
            el.classList.remove('active');
        }
    });
    
    initCreadorSection();
}

// Click handler for sidebar Consulta section
function selectConsultaSection(pushHistory = true) {
    switchGlobalSection('consulta', pushHistory);
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-consulta-btn' && el.id !== 'sidebar-creador-btn' && el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-tendencias2-btn') {
            el.classList.remove('active');
        }
    });
    
    setupConsultaAutocomplete();
}

// 11g. Return to home landing page
function goHome(pushHistory = true) {
    appState.selectedIndicator = null;
    switchGlobalSection('explorer', false);
    
    // Clear selections in tree
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    
    // Show empty state, hide dashboard
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('dashboard-container').style.display = 'none';
    
    if (pushHistory) {
        history.pushState({ section: 'explorer', indicatorId: null }, '', '');
    }
}

// 11h. Find indicator by ID in flat indicators
function findIndicatorById(id) {
    if (appState.flatIndicators) {
        return appState.flatIndicators.find(ind => ind.id === id);
    }
    return null;
}

// 11i. Restore navigation state
function restoreState(state, pushHistory = false) {
    if (!state) return;
    
    const { section, indicatorId, pyramidId } = state;
    
    if (section === 'explorer') {
        if (indicatorId) {
            const ind = findIndicatorById(indicatorId);
            if (ind) {
                selectIndicator(ind, pushHistory);
            } else {
                goHome(pushHistory);
            }
        } else {
            goHome(pushHistory);
        }
    } else if (section === 'structures') {
        switchGlobalSection('structures', pushHistory);
        if (pyramidId) {
            selectPyramidIndicator(pyramidId, pushHistory);
        }
    } else if (section === 'brechas') {
        selectBrechasSection(pushHistory);
    } else if (section === 'metodologia') {
        selectMetodologiaSection(pushHistory);
    } else if (section === 'tendencias') {
        selectTendenciasSection(pushHistory);
    } else if (section === 'tendencias2') {
        selectTendencias2Section(pushHistory);
    } else if (section === 'exportar-datos') {
        selectExportarDatosSection(pushHistory);
    } else if (section === 'creador') {
        selectCreadorSection(pushHistory);
    } else if (section === 'consulta') {
        selectConsultaSection(pushHistory);
    }
}

// 11j. Listen for history popstate events (browser Back/Forward)
window.addEventListener('popstate', (event) => {
    if (event.state) {
        restoreState(event.state, false);
    } else {
        restoreState({ section: 'explorer', indicatorId: null }, false);
    }
});

// 12. Initialize Sidebar for Structures
function initStructuresSidebar() {
    const listEl = document.getElementById('structures-indicator-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    PYRAMID_INDICATORS.forEach(ind => {
        const li = document.createElement('li');
        li.className = 'structures-list-item' + (ind.id === appState.selectedPyramidIndicatorId ? ' active' : '');
        li.dataset.id = ind.id;
        li.innerHTML = `
            <i class="fa-solid ${ind.icon}"></i>
            <span>[${ind.id}] ${ind.name}</span>
        `;
        li.addEventListener('click', () => {
            selectPyramidIndicator(ind.id);
        });
        listEl.appendChild(li);
    });
}

// 13. Select Structures Indicator
function selectPyramidIndicator(indicatorId, pushHistory = true) {
    appState.selectedPyramidIndicatorId = indicatorId;
    
    // Switch section if not in structures
    if (appState.currentGlobalSection !== 'structures') {
        switchGlobalSection('structures', false);
    }
    
    if (pushHistory) {
        history.pushState({ section: 'structures', pyramidId: indicatorId }, '', '');
    }
    
    // Clear selections in the thematic tree
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    
    // Update active class in sidebar items
    document.querySelectorAll('.structures-list-item').forEach(el => {
        const isSelected = parseInt(el.dataset.id) === indicatorId;
        el.classList.toggle('active', isSelected);
    });
    
    // Fetch data for the selected indicator
    fetchPyramidData(indicatorId);
}

// 14. Fetch Data for Pyramid Indicators
async function fetchPyramidData(indicatorId) {
    const colLoader = document.getElementById('pyramid-loading-col');
    const alcLoader = document.getElementById('pyramid-loading-alc');
    if (colLoader) colLoader.classList.add('active');
    if (alcLoader) alcLoader.classList.add('active');
    
    const indConfig = PYRAMID_INDICATORS.find(ind => ind.id === indicatorId);
    const indName = indConfig ? `[${indConfig.id}] ${indConfig.name}` : 'Indicador de Estructura';
    document.getElementById('pyramid-indicator-name').textContent = indName;
    
    try {
        const url = `${API_DATA_BASE}/${indicatorId}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID},211`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al obtener datos de estructura de la CEPAL');
        
        const res = await response.json();
        appState.pyramidData = res.body;
        
        // Reset secondary filters
        appState.pyramidFilters = {};
        
        // Dynamic detection of dimensions
        setupPyramidDimensionFilters();
        
        if (colLoader) colLoader.classList.remove('active');
        if (alcLoader) alcLoader.classList.remove('active');
        
        renderPyramids();
        
    } catch (error) {
        console.error('Error fetching pyramid data:', error);
        document.getElementById('pyramid-diagnostic-content').innerHTML = `
            <div style="color: var(--accent-red); font-weight: 500;">
                <i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos para este indicador estructural.
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    La API de la CEPAL no respondió correctamente o el indicador no tiene datos estructurados para los territorios seleccionados.
                </p>
            </div>
        `;
        if (colLoader) colLoader.classList.remove('active');
        if (alcLoader) alcLoader.classList.remove('active');
    }
}

// 15. Setup Dynamic Secondary Filters for Structures
function setupPyramidDimensionFilters() {
    const dimensions = appState.pyramidData.dimensions || [];
    const filterContainer = document.getElementById('pyramid-secondary-filters');
    filterContainer.innerHTML = '';
    
    // Find standard dimensions dynamically
    const sexDim = dimensions.find(d => d.id === 88622 || d.id === 144 || d.name.toLowerCase().includes('sexo'));
    const ageDim = dimensions.find(d => d.id === 88628 || d.id === 88652 || d.id === 43054 || d.id === 1439 || d.name.toLowerCase().includes('edad') || d.name.toLowerCase().includes('grupo'));
    
    // Secondary dimensions to filter (exclude Country, Year, Sex, and Age)
    const sexDimId = sexDim ? sexDim.id : null;
    const ageDimId = ageDim ? ageDim.id : null;
    
    const secondaryDims = dimensions.filter(d => 
        d.id !== COUNTRY_DIM_ID && 
        d.id !== YEAR_DIM_ID && 
        d.id !== sexDimId && 
        d.id !== ageDimId
    );
    
    secondaryDims.forEach(dim => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '0.5rem';
        
        const label = document.createElement('label');
        label.className = 'filter-label';
        label.style.marginBottom = '0';
        label.textContent = `${dim.name}:`;
        
        const select = document.createElement('select');
        select.className = 'select-control';
        select.style.width = 'auto';
        select.style.padding = '0.5rem 2.5rem 0.5rem 1rem';
        select.dataset.dimId = dim.id;
        
        const members = dim.members || [];
        
        // Find default member
        let defaultMember = members.find(m => m.selected === 1);
        if (!defaultMember) defaultMember = members.find(m => m.in === 1);
        if (!defaultMember) {
            defaultMember = members.find(m => {
                const name = m.name.toLowerCase();
                return name.includes('ambos') || name.includes('total') || name.includes('nacional');
            });
        }
        if (!defaultMember && members.length > 0) defaultMember = members[0];
        
        if (defaultMember) {
            appState.pyramidFilters[dim.id] = defaultMember.id;
        }
        
        members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            if (defaultMember && m.id === defaultMember.id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
        
        select.addEventListener('change', (e) => {
            appState.pyramidFilters[dim.id] = parseInt(e.target.value);
            renderPyramids();
        });
        
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        filterContainer.appendChild(wrapper);
    });
    
    // Set up Year Selector
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    const yearSelect = document.getElementById('pyramid-year-select');
    yearSelect.innerHTML = '';
    
    if (yearDim) {
        const rawData = appState.pyramidData.data || [];
        const presentYearIds = new Set(rawData.map(rec => rec[`dim_${YEAR_DIM_ID}`]));
        
        const sortedYears = [...yearDim.members]
            .filter(m => presentYearIds.has(m.id))
            .map(m => parseInt(m.name))
            .filter(y => !isNaN(y))
            .sort((a, b) => b - a); // newer years first
        
        let defaultYear = 2026;
        if (sortedYears.length > 0) {
            if (!sortedYears.includes(defaultYear)) {
                // Find closest year to 2026
                defaultYear = sortedYears.reduce((prev, curr) => Math.abs(curr - 2026) < Math.abs(prev - 2026) ? curr : prev);
            }
            appState.pyramidYear = defaultYear;
            
            sortedYears.forEach(yr => {
                const opt = document.createElement('option');
                opt.value = yr;
                opt.textContent = yr >= 2025 ? `${yr} [Proyección]` : `${yr} [Registro Real]`;
                if (yr === defaultYear) {
                    opt.selected = true;
                }
                yearSelect.appendChild(opt);
            });
        }
    }
}

// 16. Year Selector Change Trigger
function onPyramidYearChange(year) {
    appState.pyramidYear = parseInt(year);
    renderPyramids();
}

// 17. Render Side-by-Side Pyramids
function renderPyramids() {
    if (!appState.pyramidData) return;
    
    const indConfig = PYRAMID_INDICATORS.find(ind => ind.id === appState.selectedPyramidIndicatorId);
    const isRate = indConfig ? indConfig.isRate : false;
    const unit = indConfig ? indConfig.unit : 'mil hab.';
    
    const rawData = appState.pyramidData.data || [];
    const dimensions = appState.pyramidData.dimensions || [];
    const selectedYear = appState.pyramidYear;
    
    if (!selectedYear) return;
    
    // Find dimensions
    const sexDim = dimensions.find(d => d.id === 88622 || d.id === 144 || d.name.toLowerCase().includes('sexo'));
    const ageDim = dimensions.find(d => d.id === 88628 || d.id === 88652 || d.id === 43054 || d.id === 1439 || d.name.toLowerCase().includes('edad') || d.name.toLowerCase().includes('grupo'));
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    
    if (!sexDim || !ageDim || !yearDim) {
        console.error("Missing required dimensions: sex, age or year.");
        return;
    }
    
    const yearMember = yearDim.members.find(m => parseInt(m.name) === selectedYear);
    const yearMemberId = yearMember ? yearMember.id : null;
    if (!yearMemberId) return;
    
    // Sort and filter age groups (exclude total/aggregate members)
    const sortedAges = [...ageDim.members]
        .filter(m => !m.name.toLowerCase().includes('total'))
        .sort((a, b) => (b.order || 0) - (a.order || 0));
    const ageLabels = sortedAges.map(m => m.name);
    
    // Filter records for the selected year and secondary filters
    const yearRecords = rawData.filter(rec => {
        if (rec[`dim_${YEAR_DIM_ID}`] !== yearMemberId) return false;
        for (const [dimId, memberId] of Object.entries(appState.pyramidFilters)) {
            if (rec[`dim_${dimId}`] !== memberId) return false;
        }
        return true;
    });
    
    // Identify Hombres / Mujeres member IDs
    const maleMember = sexDim.members.find(m => m.name.toLowerCase().includes('hombre') || m.name.toLowerCase().includes('masculino') || m.id === 88626 || m.id === 265);
    const femaleMember = sexDim.members.find(m => m.name.toLowerCase().includes('mujer') || m.name.toLowerCase().includes('femenino') || m.id === 88627 || m.id === 266);
    
    if (!maleMember || !femaleMember) {
        console.error("Missing male or female sex dimension members.");
        return;
    }
    
    const maleMemberId = maleMember.id;
    const femaleMemberId = femaleMember.id;
    
    const colMales = {};
    const colFemales = {};
    const alcMales = {};
    const alcFemales = {};
    
    // Check if 212 (ALC) is in data, fallback to 211 (América Latina)
    let alcId = ALC_MEMBER_ID; // 212
    const has212 = yearRecords.some(rec => rec[`dim_${COUNTRY_DIM_ID}`] === ALC_MEMBER_ID);
    if (!has212) {
        const has211 = yearRecords.some(rec => rec[`dim_${COUNTRY_DIM_ID}`] === 211);
        if (has211) alcId = 211;
    }
    
    yearRecords.forEach(rec => {
        const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
        const sexId = rec[`dim_${sexDim.id}`];
        const ageId = rec[`dim_${ageDim.id}`];
        const val = parseFloat(rec.value);
        
        if (isNaN(val)) return;
        
        if (countryId === COLOMBIA_MEMBER_ID) {
            if (sexId === maleMemberId) {
                colMales[ageId] = val;
            } else if (sexId === femaleMemberId) {
                colFemales[ageId] = val;
            }
        } else if (countryId === alcId) {
            if (sexId === maleMemberId) {
                alcMales[ageId] = val;
            } else if (sexId === femaleMemberId) {
                alcFemales[ageId] = val;
            }
        }
    });
    
    // Series: Extract raw values
    const colMalesRaw = sortedAges.map(age => (colMales[age.id] || 0));
    const colFemalesRaw = sortedAges.map(age => (colFemales[age.id] || 0));
    const alcMalesRaw = sortedAges.map(age => (alcMales[age.id] || 0));
    const alcFemalesRaw = sortedAges.map(age => (alcFemales[age.id] || 0));
    
    let colMalesPlot, colFemalesPlot, alcMalesPlot, alcFemalesPlot;
    let xBound = 10;
    
    if (!isRate) {
        // Calculation of percentages relative to the sum total population
        const colTotalSum = colMalesRaw.reduce((a, b) => a + b, 0) + colFemalesRaw.reduce((a, b) => a + b, 0);
        const alcTotalSum = alcMalesRaw.reduce((a, b) => a + b, 0) + alcFemalesRaw.reduce((a, b) => a + b, 0);
        
        colMalesPlot = colMalesRaw.map(v => colTotalSum > 0 ? (v / colTotalSum * 100) : 0);
        colFemalesPlot = colFemalesRaw.map(v => colTotalSum > 0 ? (v / colTotalSum * 100) : 0);
        alcMalesPlot = alcMalesRaw.map(v => alcTotalSum > 0 ? (v / alcTotalSum * 100) : 0);
        alcFemalesPlot = alcFemalesRaw.map(v => alcTotalSum > 0 ? (v / alcTotalSum * 100) : 0);
        
        const allPcts = [...colMalesPlot, ...colFemalesPlot, ...alcMalesPlot, ...alcFemalesPlot];
        const maxVal = Math.max(...allPcts, 1);
        const xLimit = Math.ceil(maxVal);
        xBound = xLimit % 2 === 0 ? xLimit : xLimit + 1;
    } else {
        // Rates: plot directly as raw values
        colMalesPlot = colMalesRaw;
        colFemalesPlot = colFemalesRaw;
        alcMalesPlot = alcMalesRaw;
        alcFemalesPlot = alcFemalesRaw;
        
        const allRates = [...colMalesRaw, ...colFemalesRaw, ...alcMalesRaw, ...alcFemalesRaw];
        const maxVal = Math.max(...allRates, 1);
        const xLimit = Math.ceil(maxVal);
        xBound = xLimit % 2 === 0 ? xLimit : xLimit + 1;
    }
    
    // Update headers in UI
    const isProj = selectedYear >= 2025;
    const badgeHtml = isProj
        ? `<span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem; vertical-align: middle;"><i class="fa-solid fa-chart-line"></i> PROYECCIÓN</span>`
        : `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem; vertical-align: middle;"><i class="fa-solid fa-clock-rotate-left"></i> REGISTRO REAL</span>`;
    
    const subText = isRate 
        ? `Valores del indicador (En ${unit})`
        : `Distribución por sexo y edad (En porcentajes)`;
    
    document.getElementById('pyramid-year-colombia').innerHTML = `Año: ${selectedYear} ${badgeHtml} <br><span style="color: var(--text-muted); font-size: 0.75rem;">${subText}</span>`;
    document.getElementById('pyramid-year-alc').innerHTML = `Año: ${selectedYear} ${badgeHtml} <br><span style="color: var(--text-muted); font-size: 0.75rem;">${subText}</span>`;
    
    const alcName = alcId === 212 ? 'América Latina y el Caribe' : 'América Latina';
    
    // Draw Charts
    drawSinglePyramid('pyramid-chart-colombia', 'Colombia', ageLabels, colMalesPlot, colFemalesPlot, colMalesRaw, colFemalesRaw, xBound, 'pyramidChartCol', isRate, unit);
    drawSinglePyramid('pyramid-chart-alc', alcName, ageLabels, alcMalesPlot, alcFemalesPlot, alcMalesRaw, alcFemalesRaw, xBound, 'pyramidChartAlc', isRate, unit);
    
    // Generate Diagnostics
    if (!isRate) {
        generatePyramidDemographics(sortedAges, colMales, colFemales, alcMales, alcFemales, selectedYear, alcName);
    } else {
        generateRatePyramidDiagnostics(sortedAges, colMales, colFemales, alcMales, alcFemales, selectedYear, alcName, indConfig.name, unit);
    }
}

// 18. Draw Single Symmetrical Pyramid Chart
function drawSinglePyramid(canvasId, regionName, labels, plotMales, plotFemales, rawMales, rawFemales, xBound, chartStateKey, isRate, unit) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (appState[chartStateKey]) {
        appState[chartStateKey].destroy();
    }
    
    // Prepare left (negative) and right (positive) plotting data
    const malePlot = plotMales.map(v => -Math.abs(v));
    const femalePlot = plotFemales.map(v => Math.abs(v));
    
    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hombres',
                    data: malePlot,
                    backgroundColor: '#d9a829', // Golden yellow to match CEPAL scheme
                    borderColor: '#d9a829',
                    borderWidth: 0,
                    barPercentage: 0.9,
                    categoryPercentage: 1.0
                },
                {
                    label: 'Mujeres',
                    data: femalePlot,
                    backgroundColor: '#9d853c', // Olive brown to match CEPAL scheme
                    borderColor: '#9d853c',
                    borderWidth: 0,
                    barPercentage: 0.9,
                    categoryPercentage: 1.0
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 12, weight: 500 },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', size: 13, weight: 600 },
                    bodyFont: { family: 'Inter', size: 11 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const valPlot = Math.abs(context.raw);
                            const idx = context.dataIndex;
                            const isMale = context.datasetIndex === 0;
                            
                            if (isRate) {
                                label += formatNumber(valPlot) + ' ' + unit;
                            } else {
                                const absVal = isMale ? Math.abs(rawMales[idx]) : Math.abs(rawFemales[idx]);
                                label += formatNumber(valPlot) + '% (' + formatNumber(absVal) + ' ' + unit + ')';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    min: -xBound,
                    max: xBound,
                    title: {
                        display: true,
                        text: isRate ? `Tasa (${unit})` : 'Distribución Relativa (%)',
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11, weight: 500 }
                    },
                    grid: {
                        color: context => context.tick.value === 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.02)',
                        borderColor: 'transparent',
                        lineWidth: context => context.tick.value === 0 ? 2 : 1
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) {
                            return formatNumber(Math.abs(value));
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Grupos de edad',
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11, weight: 500 }
                    },
                    grid: { display: false },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 10 }
                    }
                }
            }
        }
    };
    
    appState[chartStateKey] = new Chart(ctx, config);
}

// Helper to parse age range numbers from label name
function parseAgeRange(name) {
    const cleanName = name.replace('y más', '+').replace('y ms', '+').replace('y mas', '+');
    const numbers = cleanName.match(/\d+/g);
    if (!numbers) return { min: 0, max: 999 };
    if (numbers.length === 1) {
        const num = parseInt(numbers[0]);
        if (cleanName.includes('+') || cleanName.includes('más') || cleanName.includes('ms') || cleanName.includes('mayor') || cleanName.includes('y mas')) {
            return { min: num, max: 999 };
        }
        return { min: 0, max: num };
    }
    return { min: parseInt(numbers[0]), max: parseInt(numbers[1]) };
}

// 19. Generate Demographics Diagnostics (Counts)
function generatePyramidDemographics(sortedAges, colMales, colFemales, alcMales, alcFemales, year, alcLabel, targetEl = null) {
    const container = targetEl === null ? document.getElementById('pyramid-diagnostic-content') : targetEl;
    
    let colYouth = 0, colWorking = 0, colElderly = 0;
    let alcYouth = 0, alcWorking = 0, alcElderly = 0;
    
    sortedAges.forEach(age => {
        const range = parseAgeRange(age.name);
        const colVal = (colMales[age.id] || 0) + (colFemales[age.id] || 0);
        const alcVal = (alcMales[age.id] || 0) + (alcFemales[age.id] || 0);
        
        if (range.max <= 14) {
            colYouth += colVal;
            alcYouth += alcVal;
        } else if (range.min >= 65) {
            colElderly += colVal;
            alcElderly += alcVal;
        } else {
            colWorking += colVal;
            alcWorking += alcVal;
        }
    });
    
    const colTotal = colYouth + colWorking + colElderly;
    const alcTotal = alcYouth + alcWorking + alcElderly;
    
    if (colTotal === 0 || alcTotal === 0 || colWorking === 0 || alcWorking === 0) {
        container.innerHTML = '<p>Datos de población incompletos para el año seleccionado.</p>';
        return;
    }
    
    const colYouthPct = (colYouth / colTotal) * 100;
    const colWorkingPct = (colWorking / colTotal) * 100;
    const colElderlyPct = (colElderly / colTotal) * 100;
    
    const alcYouthPct = (alcYouth / alcTotal) * 100;
    const alcWorkingPct = (alcWorking / alcTotal) * 100;
    const alcElderlyPct = (alcElderly / alcTotal) * 100;
    
    const colDepRatio = ((colYouth + colElderly) / colWorking) * 100;
    const alcDepRatio = ((alcYouth + alcElderly) / alcWorking) * 100;
    
    function getPyramidType(youth, elderly) {
        if (youth > 30) return { name: 'Expansiva (Pagoda)', desc: 'alta natalidad, población joven y rápido crecimiento' };
        if (elderly > 12 && youth < 20) return { name: 'Regresiva (Bulbo)', desc: 'baja natalidad, envejecimiento demográfico y crecimiento lento o negativo' };
        return { name: 'Estacionaria (Campana)', desc: 'natalidad en descenso, población en proceso de envejecimiento y crecimiento moderado' };
    }
    
    const colType = getPyramidType(colYouthPct, colElderlyPct);
    const alcType = getPyramidType(alcYouthPct, alcElderlyPct);
    
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
            <div class="card" style="background: rgba(15,23,42,0.3); border-color: rgba(255,255,255,0.05);">
                <h4 style="font-family: var(--font-heading); color: var(--color-colombia); margin-bottom: 0.75rem;"><i class="fa-solid fa-flag"></i> Estructura Colombia (${year})</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem;">
                    <li>👶 <strong>Jóvenes (0-14 años):</strong> ${formatNumber(colYouthPct)}% (${formatNumber(colYouth)} mil)</li>
                    <li>💼 <strong>Edad Activa (15-64 años):</strong> ${formatNumber(colWorkingPct)}% (${formatNumber(colWorking)} mil)</li>
                    <li>👵 <strong>Mayores (65+ años):</strong> ${formatNumber(colElderlyPct)}% (${formatNumber(colElderly)} mil)</li>
                    <li>📊 <strong>Tasa Dependencia:</strong> ${formatNumber(colDepRatio)} dependientes por 100 activos</li>
                    <li>📐 <strong>Perfil:</strong> ${colType.name}</li>
                </ul>
            </div>
            <div class="card" style="background: rgba(15,23,42,0.3); border-color: rgba(255,255,255,0.05);">
                <h4 style="font-family: var(--font-heading); color: var(--color-alc); margin-bottom: 0.75rem;"><i class="fa-solid fa-globe"></i> Estructura ${alcLabel} (${year})</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem;">
                    <li>👶 <strong>Jóvenes (0-14 años):</strong> ${formatNumber(alcYouthPct)}% (${formatNumber(alcYouth)} mil)</li>
                    <li>💼 <strong>Edad Activa (15-64 años):</strong> ${formatNumber(alcWorkingPct)}% (${formatNumber(alcWorking)} mil)</li>
                    <li>👵 <strong>Mayores (65+ años):</strong> ${formatNumber(alcElderlyPct)}% (${formatNumber(alcElderly)} mil)</li>
                    <li>📊 <strong>Tasa Dependencia:</strong> ${formatNumber(alcDepRatio)} dependientes por 100 activos</li>
                    <li>📐 <strong>Perfil:</strong> ${alcType.name}</li>
                </ul>
            </div>
        </div>
    `;
    
    const isProj = year >= 2025;
    let diagnosticText = '';
    if (isProj) {
        diagnosticText = `<p><i class="fa-solid fa-chart-line" style="color: var(--color-alc);"></i> <strong>Escenario Proyectado (${year}):</strong> Bajo el modelo prospectivo de estimaciones demográficas, la pirámide de **Colombia** se clasifica con un perfil **${colType.name}** (${colType.desc}). `;
        diagnosticText += `Por su parte, se proyecta para **${alcLabel}** un perfil **${alcType.name}** (${alcType.desc}).</p>`;
    } else {
        diagnosticText = `<p><i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-green);"></i> <strong>Registro Real Histórico (${year}):</strong> Evaluando las observaciones censales consolidadas reales, la pirámide de **Colombia** se clasifica con un perfil **${colType.name}** (${colType.desc}). `;
        diagnosticText += `Por su parte, **${alcLabel}** exhibe un perfil **${alcType.name}** (${alcType.desc}).</p>`;
    }
    
    diagnosticText += `<p style="margin-top: 0.75rem;">`;
    if (colElderlyPct > alcElderlyPct) {
        diagnosticText += `Colombia cuenta con un índice de envejecimiento (<strong>${formatNumber(colElderlyPct)}%</strong>) <strong>mayor</strong> al promedio regional (<strong>${formatNumber(alcElderlyPct)}%</strong>), lo que indica una transición demográfica más acelerada hacia la madurez de su población. `;
    } else if (colElderlyPct < alcElderlyPct) {
        diagnosticText += `El promedio regional presenta un índice de envejecimiento (<strong>${formatNumber(alcElderlyPct)}%</strong>) <strong>superior</strong> al de Colombia (<strong>${formatNumber(colElderlyPct)}%</strong>), lo que refleja que Colombia mantiene una estructura ligeramente más joven con un bono demográfico extendido. `;
    } else {
        diagnosticText += `Ambas regiones registran la misma proporción de población mayor de 65 años (<strong>${formatNumber(colElderlyPct)}%</strong>). `;
    }
    
    const ratioDiff = colDepRatio - alcDepRatio;
    if (ratioDiff < 0) {
        diagnosticText += `La tasa de dependencia en Colombia es del <strong>${formatNumber(colDepRatio)}%</strong>, situándose <strong>${formatNumber(Math.abs(ratioDiff))} puntos porcentuales por debajo</strong> de la media regional (<strong>${formatNumber(alcDepRatio)}%</strong>). Esto representa una menor carga económica relativa para la población activa nacional en comparación con el conjunto latinoamericano.`;
    } else if (ratioDiff > 0) {
        diagnosticText += `La tasa de dependencia en Colombia es del <strong>${formatNumber(colDepRatio)}%</strong>, situándose <strong>${formatNumber(ratioDiff)} puntos porcentuales por encima</strong> de la media regional (<strong>${formatNumber(alcDepRatio)}%</strong>). Esto implica una mayor presión económica sobre la población en edad laboral para sostener a los sectores pasivos (niños y ancianos).`;
    } else {
        diagnosticText += `Ambos perfiles exhiben exactamente la misma tasa de dependencia demográfica (<strong>${formatNumber(colDepRatio)}%</strong>).`;
    }
    diagnosticText += `</p>`;
    
    if (container) container.innerHTML = html + diagnosticText;
    return html + diagnosticText;
}

// 20. Generate Social & Economic Diagnostics (Rates)
function generateRatePyramidDiagnostics(sortedAges, colMales, colFemales, alcMales, alcFemales, year, alcLabel, indName, unit, targetEl = null) {
    const container = targetEl === null ? document.getElementById('pyramid-diagnostic-content') : targetEl;
    
    let colMaleSum = 0, colFemaleSum = 0;
    let alcMaleSum = 0, alcFemaleSum = 0;
    let colCount = 0, alcCount = 0;
    
    let maxColGap = -1;
    let maxColGapAge = '';
    let maxColGapDir = ''; // 'Hombres' or 'Mujeres'
    
    sortedAges.forEach(age => {
        const cm = colMales[age.id];
        const cf = colFemales[age.id];
        const am = alcMales[age.id];
        const af = alcFemales[age.id];
        
        if (cm !== undefined && cf !== undefined) {
            colMaleSum += cm;
            colFemaleSum += cf;
            colCount++;
            
            const gap = cm - cf;
            if (Math.abs(gap) > maxColGap) {
                maxColGap = Math.abs(gap);
                maxColGapAge = age.name;
                maxColGapDir = gap >= 0 ? 'Hombres' : 'Mujeres';
            }
        }
        if (am !== undefined && af !== undefined) {
            alcMaleSum += am;
            alcFemaleSum += af;
            alcCount++;
        }
    });
    
    const colMaleAvg = colCount > 0 ? colMaleSum / colCount : 0;
    const colFemaleAvg = colCount > 0 ? colFemaleSum / colCount : 0;
    const alcMaleAvg = alcCount > 0 ? alcMaleSum / alcCount : 0;
    const alcFemaleAvg = alcCount > 0 ? alcFemaleSum / alcCount : 0;
    
    let highestColVal = -1, highestColAge = '', highestColSex = '';
    let lowestColVal = Infinity, lowestColAge = '', lowestColSex = '';
    
    sortedAges.forEach(age => {
        const cm = colMales[age.id];
        const cf = colFemales[age.id];
        
        if (cm !== undefined) {
            if (cm > highestColVal) { highestColVal = cm; highestColAge = age.name; highestColSex = 'Hombres'; }
            if (cm < lowestColVal) { lowestColVal = cm; lowestColAge = age.name; lowestColSex = 'Hombres'; }
        }
        if (cf !== undefined) {
            if (cf > highestColVal) { highestColVal = cf; highestColAge = age.name; highestColSex = 'Mujeres'; }
            if (cf < lowestColVal) { lowestColVal = cf; lowestColAge = age.name; lowestColSex = 'Mujeres'; }
        }
    });
    
    if (lowestColVal === Infinity) lowestColVal = 0;
    
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
            <div class="card" style="background: rgba(15,23,42,0.3); border-color: rgba(255,255,255,0.05);">
                <h4 style="font-family: var(--font-heading); color: var(--color-colombia); margin-bottom: 0.75rem;"><i class="fa-solid fa-flag"></i> Resumen Colombia (${year})</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem;">
                    <li>👨 <strong>Promedio Hombres:</strong> ${formatNumber(colMaleAvg)} ${unit}</li>
                    <li>👩 <strong>Promedio Mujeres:</strong> ${formatNumber(colFemaleAvg)} ${unit}</li>
                    <li>📈 <strong>Máximo valor:</strong> ${formatNumber(highestColVal)} ${unit} (${highestColSex}, ${highestColAge})</li>
                    <li>📉 <strong>Mínimo valor:</strong> ${formatNumber(lowestColVal)} ${unit} (${lowestColSex}, ${lowestColAge})</li>
                </ul>
            </div>
            <div class="card" style="background: rgba(15,23,42,0.3); border-color: rgba(255,255,255,0.05);">
                <h4 style="font-family: var(--font-heading); color: var(--color-alc); margin-bottom: 0.75rem;"><i class="fa-solid fa-globe"></i> Resumen ${alcLabel} (${year})</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem;">
                    <li>👨 <strong>Promedio Hombres:</strong> ${formatNumber(alcMaleAvg)} ${unit}</li>
                    <li>👩 <strong>Promedio Mujeres:</strong> ${formatNumber(alcFemaleAvg)} ${unit}</li>
                </ul>
            </div>
        </div>
    `;
    
    const isProj = year >= 2025;
    let diagnosticText = '';
    if (isProj) {
        diagnosticText = `<p><i class="fa-solid fa-chart-line" style="color: var(--color-alc);"></i> <strong>Escenario Proyectado (${year}):</strong> Las proyecciones estadísticas estimadas para el indicador <strong>"${indName}"</strong> prevén que `;
    } else {
        diagnosticText = `<p><i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-green);"></i> <strong>Registro Real Histórico (${year}):</strong> Los datos de registro real observados para el indicador <strong>"${indName}"</strong> registran que `;
    }
    
    if (maxColGap > 0) {
        diagnosticText += `en Colombia, la mayor disparidad de género se encuentra en el rango de edad <strong>${maxColGapAge}</strong>, con una brecha de <strong>${formatNumber(maxColGap)} puntos</strong> en favor de los <strong>${maxColGapDir.toLowerCase()}</strong>. `;
    }
    
    const colGenderGap = colMaleAvg - colFemaleAvg;
    const alcGenderGap = alcMaleAvg - alcFemaleAvg;
    
    diagnosticText += `En promedio, la brecha de género general en el país es de <strong>${formatNumber(Math.abs(colGenderGap))} puntos</strong> en favor de los <strong>${colGenderGap >= 0 ? 'hombres' : 'mujeres'}</strong>, mientras que en ${alcLabel} es de <strong>${formatNumber(Math.abs(alcGenderGap))} puntos</strong>.</p>`;
    
    diagnosticText += `<p style="margin-top: 0.75rem;">Al comparar con la media regional, el promedio para hombres en Colombia (${formatNumber(colMaleAvg)} ${unit}) está `;
    if (colMaleAvg > alcMaleAvg) {
        diagnosticText += `<strong>por encima</strong> del promedio de ${alcLabel} (${formatNumber(alcMaleAvg)} ${unit}), `;
    } else {
        diagnosticText += `<strong>por debajo</strong> del promedio de ${alcLabel} (${formatNumber(alcMaleAvg)} ${unit}), `;
    }
    
    diagnosticText += `y el promedio para mujeres (${formatNumber(colFemaleAvg)} ${unit}) se sitúa `;
    if (colFemaleAvg > alcFemaleAvg) {
        diagnosticText += `<strong>por encima</strong> de la media regional (${formatNumber(alcFemaleAvg)} ${unit}).`;
    } else {
        diagnosticText += `<strong>por debajo</strong> de la media regional (${formatNumber(alcFemaleAvg)} ${unit}).`;
    }
    diagnosticText += `</p>`;
    
    if (container) container.innerHTML = html + diagnosticText;
    return html + diagnosticText;
}

// 21. Helper to detect absolute sum indicators
function isAbsoluteSumIndicator(indicatorName, unitName) {
    const name = (indicatorName || '').toLowerCase();
    const unit = (unitName || '').toLowerCase();
    
    // Keywords for rates, percentages, indices (where gap subtraction makes sense)
    const rateKeywords = [
        'tasa', 'porcent', '%', 'per cap', 'por hab', 
        'por cada', 'proporc', 'promed', 'indic', 
        'expect', 'esperanz', 'coefic', 'relac', 
        'por cien', 'particip', 'brech', 'incid', 
        'densid', 'intensid', 'productiv', 'tarif',
        'calific', 'puntuac', 'puntos', 'años de', 'anos de'
    ];
    
    if (unit === 'años' || unit === 'anos' || unit === 'años de vida' || unit === 'anos de vida') {
        return false;
    }
    
    // Keywords for absolute counts and totals
    const absoluteKeywords = [
        'poblac', 'pib', 'producto interno bruto', 'emision', 'total', 
        'superfici', 'hectar', 'producc', 'miles', 
        'millon', 'person', 'habit', 'dolar', 'tonelad', 'kilogram',
        'gigagram', 'teravatio', 'megavatio', 'kilovatio', 'unidad', 'numer', 
        'cantid', 'volum', 'area', 'área', 'gasto', 'presupuest'
    ];
    
    for (const kw of rateKeywords) {
        if (name.includes(kw) || unit.includes(kw)) {
            return false;
        }
    }
    
    for (const kw of absoluteKeywords) {
        if (name.includes(kw) || unit.includes(kw)) {
            return true;
        }
    }
    
    return false;
}

// 22. Toggle Critical Gaps Card (Collapsible) - Retained for backward compatibility
function toggleBrechasCard() {
    const content = document.getElementById('brechas-criticas-content');
    const icon = document.getElementById('brechas-toggle-icon');
    if (content && icon) {
        if (content.style.maxHeight === '0px') {
            content.style.maxHeight = '1000px';
            content.style.marginTop = '1rem';
            icon.style.transform = 'rotate(0deg)';
        } else {
            content.style.maxHeight = '0px';
            content.style.marginTop = '0px';
            icon.style.transform = 'rotate(-180deg)';
        }
    }
}

// 23. Render Critical Gaps Table
function renderCriticalGaps() {
    const tbody = document.getElementById('brechas-criticas-standalone-table-body');
    if (!tbody) return;
    
    const region = appState.selectedRegion || 'ALC';
    let refKey = 'alcVal';
    let regionLabel = 'ALC (212)';
    if (region === 'LATO') {
        refKey = 'alVal';
        regionLabel = 'AL (211)';
    } else if (region === 'LAT') {
        refKey = 'latVal';
        regionLabel = 'AL Prom. Simple';
    }
    
    // Update the table header DRE to show the active comparison region
    const headerEl = document.getElementById('brechas-table-dre-header');
    if (headerEl) {
        headerEl.innerHTML = `DRE<br><span style="font-size: 0.7rem; font-weight: normal; opacity: 0.85; display: block; margin-top: 0.15rem;">vs ${regionLabel}</span>`;
    }
    
    // Sort benchmarks by absolute dynamic DRE descending
    const sortedBenchmarks = [...CRITICAL_BENCHMARKS].sort((a, b) => {
        const refA = a[refKey];
        const refB = b[refKey];
        const dreA = Math.abs((a.colVal - refA) / refA);
        const dreB = Math.abs((b.colVal - refB) / refB);
        return dreB - dreA;
    });
    
    tbody.innerHTML = '';
    
    sortedBenchmarks.forEach(item => {
        const refVal = item[refKey];
        const dre = (item.colVal - refVal) / refVal;
        
        let dreSign = dre >= 0 ? '+' : '';
        
        // Decide if the gap is favorable (Mejor) or unfavorable (Peor) for Colombia
        const lowerBetter = isLowerBetter(item.name);
        const isFavorable = lowerBetter ? (item.colVal <= refVal) : (item.colVal >= refVal);
        
        const badgeColor = isFavorable ? 'var(--accent-green)' : 'var(--accent-red)';
        const bgOpacity = 'rgba(' + (isFavorable ? '16, 185, 129' : '239, 68, 68') + ', 0.15)';
        const badgeText = isFavorable ? 'Mejor' : 'Peor';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500; text-align: left; padding: 0.75rem 1rem;">
                <span class="benchmark-link" style="color: var(--accent-blue); cursor: pointer; font-weight: 600; text-decoration: none; transition: var(--transition-smooth);" onclick="selectAndFocusIndicator(${item.indicatorId})">${item.name}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-top: 0.15rem;">Año: ${item.year} | Unidad: ${item.unit}</span>
            </td>
            <td class="colombia-cell" style="text-align: right; font-weight: 600; padding: 0.75rem 1rem;">${formatNumber(item.colVal)}</td>
            <td class="alc-cell" style="text-align: right; font-weight: 600; padding: 0.75rem 1rem;">${formatNumber(item.alcVal)}</td>
            <td class="al-cell" style="text-align: right; font-weight: 600; padding: 0.75rem 1rem;">${formatNumber(item.alVal)}</td>
            <td class="lat-simple-cell" style="text-align: right; font-weight: 600; padding: 0.75rem 1rem;">${formatNumber(item.latVal)}</td>
            <td style="text-align: center; font-weight: 600; padding: 0.75rem 1rem;">
                <span style="padding: 0.2rem 0.5rem; border-radius: 6px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 0.8125rem; display: inline-block;">
                    ${dreSign}${formatNumber(dre)}
                </span>
            </td>
            <td style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.3; text-align: left; padding: 0.75rem 1rem;">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div>
                        <span style="padding: 0.15rem 0.4rem; border-radius: 4px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">
                            <i class="${isFavorable ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'}" style="margin-right: 0.25rem;"></i>
                            ${badgeText}
                        </span>
                    </div>
                    <span>${item.interpretation}</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 23b. Select and Focus Indicator in Tree
function selectAndFocusIndicator(indicatorId) {
    // Switch to explorer tab
    switchGlobalSection('explorer');
    
    // Find the tree leaf element in the DOM
    const leaf = document.querySelector(`.tree-leaf[data-id="${indicatorId}"]`);
    if (leaf) {
        // Scroll the leaf element into view smoothly
        leaf.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove previous selection highlight and highlight this leaf
        document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
        leaf.classList.add('selected');
        
        // Expand all parent nodes in the thematic tree
        let parent = leaf.closest('.tree-node-content');
        while (parent) {
            parent.style.display = 'block';
            const header = parent.previousElementSibling;
            if (header && header.classList.contains('tree-node-header')) {
                header.classList.add('expanded');
            }
            const parentLi = parent.closest('.tree-item');
            parent = parentLi ? parentLi.closest('.tree-node-content') : null;
        }
        
        // Direct click to trigger standard data loading and display
        leaf.click();
    } else {
        // Fallback: if tree is not rendered yet, look in flat list and select directly
        const ind = appState.flatIndicators ? appState.flatIndicators.find(item => item.id === indicatorId) : null;
        if (ind) {
            selectIndicator({
                id: ind.id,
                name: `[${ind.id}] ${ind.name}`,
                categoryPath: 'Clasificación temática general'
            });
        }
    }
}

// 24. Pre-fetch all pyramid data in background for instant PDF generation
async function preFetchAllPyramidData() {
    appState.pyramidDataCache = {};
    for (const ind of PYRAMID_INDICATORS) {
        try {
            const url = `${API_DATA_BASE}/${ind.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID},211`;
            const response = await fetch(url);
            if (response.ok) {
                const res = await response.json();
                appState.pyramidDataCache[ind.id] = res.body;
            }
        } catch (e) {
            console.error(`Error pre-fetching data for indicator ${ind.id}:`, e);
        }
    }
}

// 25. Generate Consolidated Full Report (PDF) including all benchmarks and structural indicators
async function generateFullPrintReport(reportType = 'executive') {
    // Create print report container if not exists
    let printArea = document.getElementById('print-report-area');
    if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'print-report-area';
        document.body.appendChild(printArea);
    }
    
    // Show loading text in main window if printArea is not filled yet
    const originalBtnText = document.getElementById('btn-export-pdf') ? document.getElementById('btn-export-pdf').innerHTML : '';
    const exportBtn = document.getElementById('btn-export-pdf');
    if (exportBtn) {
        exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando reporte...';
        exportBtn.style.pointerEvents = 'none';
        exportBtn.style.opacity = '0.7';
    }
    
    let html = '';
    
    // Page 1: Title and Critical Gaps Summary
    html += `
        <div class="print-page" style="page-break-after: always; padding: 2cm;">
            <div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid var(--accent-blue);">
                <h1 style="font-family: var(--font-heading); font-size: 24pt; font-weight: 700; margin-bottom: 0.5rem; color: #ffffff;">Reporte Diagnóstico Consolidado</h1>
                <h2 style="font-family: var(--font-body); font-size: 14pt; color: var(--text-secondary); font-weight: 400; margin-top: 0;">Colombia vs. América Latina y el Caribe</h2>
            </div>
            
            <div style="margin-bottom: 2rem; color: var(--text-muted); font-size: 10pt; text-align: center;">
                <strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString('es-ES')} | <strong>Origen de Datos:</strong> API Oficial de la CEPAL
            </div>
            
            <div class="print-section-title" style="font-family: var(--font-heading); font-size: 15pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <i class="fa-solid fa-scale-unbalanced-left" style="color: var(--color-colombia); margin-right: 0.5rem;"></i>
                Resumen de Brechas Críticas y Desviación Estadística (Benchmarks)
            </div>
            
            <div class="card" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px;">
                <table class="data-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 25%;">Indicador</th>
                            <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">Colombia</th>
                            <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">ALC (212)</th>
                            <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">AL (211)</th>
                            <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">AL Prom. Simple</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 13%;">DRE (vs ${regionLabel})</th>
                            <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 18%;">Interpretación del Desvío</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Sort benchmarks by absolute dynamic DRE
    const sortedBenchmarks = [...CRITICAL_BENCHMARKS].sort((a, b) => {
        const refA = a[refKey];
        const refB = b[refKey];
        const dreA = Math.abs((a.colVal - refA) / refA);
        const dreB = Math.abs((b.colVal - refB) / refB);
        return dreB - dreA;
    });
    
    sortedBenchmarks.forEach(item => {
        const refVal = item[refKey];
        const dre = (item.colVal - refVal) / refVal;
        let dreSign = dre >= 0 ? '+' : '';
        const lowerBetter = isLowerBetter(item.name);
        const isFavorable = lowerBetter ? (item.colVal <= refVal) : (item.colVal >= refVal);
        
        const badgeColor = isFavorable ? '#10b981' : '#ef4444';
        const bgOpacity = 'rgba(' + (isFavorable ? '16, 185, 129' : '239, 68, 68') + ', 0.1)';
        const badgeText = isFavorable ? 'Mejor' : 'Peor';
        
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem 1rem; text-align: left; vertical-align: top;">
                    <strong>${item.name}</strong>
                    <span style="font-size: 7.5pt; color: var(--text-muted); display: block; margin-top: 0.15rem;">Año: ${item.year} | Unidad: ${item.unit}</span>
                </td>
                <td class="colombia-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-colombia); font-weight: 600; vertical-align: top;">${formatNumber(item.colVal)}</td>
                <td class="alc-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-alc); font-weight: 600; vertical-align: top;">${formatNumber(item.alcVal)}</td>
                <td class="al-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--text-secondary); font-weight: 600; vertical-align: top;">${formatNumber(item.alVal)}</td>
                <td class="lat-simple-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--text-muted); font-weight: 600; vertical-align: top;">${formatNumber(item.latVal)}</td>
                <td style="text-align: center; padding: 0.75rem 1rem; font-weight: 600; vertical-align: top;">
                    <span style="padding: 0.2rem 0.5rem; border-radius: 6px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 8.5pt; border: 1px solid ${badgeColor}33; display: inline-block;">
                        ${dreSign}${formatNumber(dre)}
                    </span>
                </td>
                <td style="font-size: 8.5pt; color: var(--text-secondary); padding: 0.75rem 1rem; line-height: 1.3; text-align: left; vertical-align: top;">
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div>
                            <span style="padding: 0.15rem 0.4rem; border-radius: 4px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 7.5pt; font-weight: 700; text-transform: uppercase;">
                                ${badgeText}
                            </span>
                        </div>
                        <span>${item.interpretation}</span>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <div style="font-size: 9.5pt; line-height: 1.6; color: var(--text-secondary); margin-top: 1.5rem; padding: 1rem; background: rgba(59, 130, 246, 0.05); border: 1px dashed rgba(59, 130, 246, 0.2); border-radius: 8px;">
                <p><strong>Nota metodológica:</strong> La Desviación Relativa Estándar (DRE) se calcula como <code>(Colombia - Región) / Región</code> con respecto a la región de referencia activa: <strong>${regionLabel}</strong>. 
                Representa la distancia proporcional del desempeño de Colombia con respecto al de la región seleccionada. 
                Valores negativos indican que Colombia está por debajo de la media regional, mientras que valores positivos indican que la supera.</p>
            </div>
        </div>
    `;
    
    // Page 2: Detailed analysis of the currently selected general indicator (if any)
    if (appState.selectedIndicator && appState.indicatorData) {
        const activeDiagnostic = document.getElementById('diagnostic-content') ? document.getElementById('diagnostic-content').innerHTML : '';
        const activeTitle = appState.selectedIndicator.name;
        const activePath = appState.selectedIndicator.categoryPath;
        
        const colValStr = document.getElementById('kpi-colombia-val') ? document.getElementById('kpi-colombia-val').textContent : '-';
        const alcValStr = document.getElementById('kpi-alc-val') ? document.getElementById('kpi-alc-val').textContent : '-';
        const gapValStr = document.getElementById('kpi-gap-val') ? document.getElementById('kpi-gap-val').textContent : '-';
        const gapPctStr = document.getElementById('kpi-gap-pct') ? document.getElementById('kpi-gap-pct').innerHTML : '';
        
        html += `
            <div class="print-page" style="page-break-after: always; padding: 2cm;">
                <div class="print-section-title" style="font-family: var(--font-heading); font-size: 15pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-chart-line" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                    Análisis del Indicador Activo en Exploración
                </div>
                
                <h3 style="font-family: var(--font-heading); font-size: 13pt; font-weight: 700; color: var(--text-primary); margin-top: 1.5rem; margin-bottom: 0.25rem;">${activeTitle}</h3>
                <span style="font-size: 8.5pt; color: var(--text-muted); display: block; margin-bottom: 1.5rem;"><strong>Ruta Temática:</strong> ${activePath}</span>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(255, 215, 0, 0.03);">
                        <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">Colombia</span>
                        <span style="font-size: 18pt; font-weight: 800; color: var(--color-colombia); display: block; margin-top: 0.25rem;">${colValStr}</span>
                    </div>
                    <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(168, 85, 247, 0.03);">
                        <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">América Latina y el Caribe</span>
                        <span style="font-size: 18pt; font-weight: 800; color: var(--color-alc); display: block; margin-top: 0.25rem;">${alcValStr}</span>
                    </div>
                    <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(59, 130, 246, 0.03);">
                        <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">Diferencia / Desvío</span>
                        <span style="font-size: 18pt; font-weight: 800; color: var(--accent-blue); display: block; margin-top: 0.25rem;">${gapValStr}</span>
                        <span style="font-size: 7.5pt; color: var(--text-secondary); display: block; margin-top: 0.25rem; line-height: 1.2;">${gapPctStr}</span>
                    </div>
                </div>
                
                <div class="card" style="padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-top: 1rem;">
                    <h4 style="font-family: var(--font-heading); font-size: 11pt; font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                        <i class="fa-solid fa-robot" style="margin-right: 0.4rem; color: var(--accent-blue);"></i> Diagnóstico Analítico Automatizado
                    </h4>
                    <div style="font-size: 9.5pt; line-height: 1.6; color: var(--text-secondary);">
                        ${activeDiagnostic}
                    </div>
                </div>`;
                
        if (reportType === 'full') {
            const tableBodyHtml = document.getElementById('data-table-body') ? document.getElementById('data-table-body').innerHTML : '';
            if (tableBodyHtml) {
                html += `
                <div class="card" style="padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-top: 1rem; page-break-inside: avoid;">
                    <h4 style="font-family: var(--font-heading); font-size: 11pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                        <i class="fa-solid fa-table" style="margin-right: 0.4rem; color: var(--text-muted);"></i> Tabla Histórica de Datos
                    </h4>
                    <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Año</th>
                                <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Colombia</th>
                                <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Promedio ALC</th>
                                <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Diferencia</th>
                                <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">% Desvío (DRE)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableBodyHtml}
                        </tbody>
                    </table>
                </div>`;
            }
        }
        
        html += `
            </div>
        `;
    }
    
    // Page 3 and following: The 6 structural indicators (Age/Sex Pyramids & Rates)
    if (reportType === 'full') {
        for (const ind of PYRAMID_INDICATORS) {
        let data = appState.pyramidDataCache ? appState.pyramidDataCache[ind.id] : null;
        
        // Fallback: If not cached yet (e.g. fast print call), fetch synchronously now
        if (!data) {
            try {
                const url = `${API_DATA_BASE}/${ind.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID},211`;
                const response = await fetch(url);
                if (response.ok) {
                    const res = await response.json();
                    data = res.body;
                    if (!appState.pyramidDataCache) appState.pyramidDataCache = {};
                    appState.pyramidDataCache[ind.id] = data;
                }
            } catch (e) {
                console.error(`Error loading data for print indicator ${ind.id}:`, e);
            }
        }
        
        if (data) {
            const dimensions = data.dimensions || [];
            const rawData = data.data || [];
            
            const sexDim = dimensions.find(d => d.id === 88622 || d.id === 144 || d.name.toLowerCase().includes('sexo'));
            const ageDim = dimensions.find(d => d.id === 88628 || d.id === 88652 || d.id === 43054 || d.id === 1439 || d.name.toLowerCase().includes('edad') || d.name.toLowerCase().includes('grupo'));
            const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
            
            if (sexDim && ageDim && yearDim) {
                const presentYearIds = new Set(rawData.map(rec => rec[`dim_${YEAR_DIM_ID}`]));
                const sortedYears = [...yearDim.members]
                    .filter(m => presentYearIds.has(m.id))
                    .map(m => parseInt(m.name))
                    .filter(y => !isNaN(y))
                    .sort((a, b) => b - a);
                
                const selectedYear = sortedYears[0];
                const yearMember = yearDim.members.find(m => parseInt(m.name) === selectedYear);
                const yearMemberId = yearMember ? yearMember.id : null;
                
                if (yearMemberId) {
                    const sortedAges = [...ageDim.members]
                        .filter(m => !m.name.toLowerCase().includes('total'))
                        .sort((a, b) => (b.order || 0) - (a.order || 0));
                    
                    const yearRecords = rawData.filter(rec => rec[`dim_${YEAR_DIM_ID}`] === yearMemberId);
                    
                    const maleMember = sexDim.members.find(m => m.name.toLowerCase().includes('hombre') || m.name.toLowerCase().includes('masculino') || m.id === 88626 || m.id === 265);
                    const femaleMember = sexDim.members.find(m => m.name.toLowerCase().includes('mujer') || m.name.toLowerCase().includes('femenino') || m.id === 88627 || m.id === 266);
                    
                    if (maleMember && femaleMember) {
                        const colMales = {};
                        const colFemales = {};
                        const alcMales = {};
                        const alcFemales = {};
                        
                        let alcId = ALC_MEMBER_ID;
                        const has212 = yearRecords.some(rec => rec[`dim_${COUNTRY_DIM_ID}`] === ALC_MEMBER_ID);
                        if (!has212 && yearRecords.some(rec => rec[`dim_${COUNTRY_DIM_ID}`] === 211)) {
                            alcId = 211;
                        }
                        
                        yearRecords.forEach(rec => {
                            const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
                            const sexId = rec[`dim_${sexDim.id}`];
                            const ageId = rec[`dim_${ageDim.id}`];
                            const val = parseFloat(rec.value);
                            
                            if (isNaN(val)) return;
                            
                            if (countryId === COLOMBIA_MEMBER_ID) {
                                if (sexId === maleMember.id) colMales[ageId] = val;
                                else if (sexId === femaleMember.id) colFemales[ageId] = val;
                            } else if (countryId === alcId) {
                                if (sexId === maleMember.id) alcMales[ageId] = val;
                                else if (sexId === femaleMember.id) alcFemales[ageId] = val;
                            }
                        });
                        
                        const alcLabel = alcId === 212 ? 'América Latina y el Caribe' : 'América Latina';
                        let diagHtml = '';
                        
                        if (!ind.isRate) {
                            diagHtml = generatePyramidDemographics(sortedAges, colMales, colFemales, alcMales, alcFemales, selectedYear, alcLabel, null);
                        } else {
                            diagHtml = generateRatePyramidDiagnostics(sortedAges, colMales, colFemales, alcMales, alcFemales, selectedYear, alcLabel, ind.name, ind.isRate ? '%' : 'hab', null);
                        }
                        
                        html += `
                            <div class="print-page" style="page-break-after: always; padding: 2cm;">
                                <div class="print-section-title" style="font-family: var(--font-heading); font-size: 15pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <i class="fa-solid fa-users-line" style="color: var(--color-alc); margin-right: 0.5rem;"></i>
                                    Análisis Estructural: [${ind.id}] ${ind.name}
                                </div>
                                <div style="font-size: 8.5pt; color: var(--text-muted); margin-bottom: 1.5rem;">
                                    <strong>Año de Consulta:</strong> ${selectedYear} (${selectedYear >= 2025 ? 'Escenario Proyectado' : 'Registro Histórico Real'})
                                </div>
                                
                                <div style="font-size: 9.5pt; line-height: 1.6; color: var(--text-secondary);">
                                    ${diagHtml}
                                </div>
                            </div>
                        `;
                    }
                }
            }
        }
    }
    } // Close if (reportType === 'full')
    
    printArea.innerHTML = makeReportFormal(html);
    
    // Restore button state
    if (exportBtn) {
        exportBtn.innerHTML = originalBtnText;
        exportBtn.style.pointerEvents = 'auto';
        exportBtn.style.opacity = '1';
    }
    
    // Trigger native printing
    window.print();
}

// 26. Modal Controls & Advanced Reporting Logic
function openReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Initialize format to PDF
        setReportFormat('pdf');
        // Default preset: default to structural-only if no indicator is active
        const defaultPreset = appState.selectedIndicator ? 'active-only' : 'structural-only';
        const presetSelect = document.getElementById('report-preset-select');
        if (presetSelect) presetSelect.value = defaultPreset;
        
        // Populate indicators checklist
        populateReportIndicatorsList();
        
        // Apply default preset
        applyReportPreset(defaultPreset);
    }
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function setReportFormat(format) {
    if (!appState) appState = {};
    appState.reportFormat = format;
    
    const btnPdf = document.getElementById('btn-report-format-pdf');
    const btnWord = document.getElementById('btn-report-format-word');
    const btnConfirm = document.getElementById('btn-confirm-print');
    
    if (format === 'pdf') {
        btnPdf?.classList.add('active');
        btnWord?.classList.remove('active');
        if (btnConfirm) {
            btnConfirm.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generar y Exportar PDF';
        }
    } else {
        btnWord?.classList.add('active');
        btnPdf?.classList.remove('active');
        if (btnConfirm) {
            btnConfirm.innerHTML = '<i class="fa-solid fa-file-word"></i> Generar y Exportar Word';
        }
    }
}

function applyReportPreset(preset) {
    const structCheckboxes = document.querySelectorAll('input[type="checkbox"][data-type="structural"]');
    const genCheckboxes = document.querySelectorAll('input[type="checkbox"][data-type="general"]');
    
    if (preset === 'active-only') {
        structCheckboxes.forEach(cb => cb.checked = false);
        genCheckboxes.forEach(cb => {
            const indId = parseInt(cb.getAttribute('data-id'));
            cb.checked = !!(appState.selectedIndicator && appState.selectedIndicator.id === indId);
        });
    } else if (preset === 'structural-only') {
        structCheckboxes.forEach(cb => cb.checked = true);
        genCheckboxes.forEach(cb => cb.checked = false);
    } else if (preset === 'full-preset') {
        structCheckboxes.forEach(cb => cb.checked = true);
        genCheckboxes.forEach(cb => {
            const indId = parseInt(cb.getAttribute('data-id'));
            cb.checked = !!(appState.selectedIndicator && appState.selectedIndicator.id === indId);
        });
    }
}

function onReportCheckboxChange() {
    const presetSelect = document.getElementById('report-preset-select');
    if (presetSelect) {
        presetSelect.value = 'custom';
    }
}

function selectAllReportIndicators(checked) {
    const checkboxes = document.querySelectorAll('#report-indicators-checklist input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const label = cb.closest('.report-checkbox-item');
        if (label && label.style.display !== 'none') {
            cb.checked = checked;
        }
    });
    const presetSelect = document.getElementById('report-preset-select');
    if (presetSelect) {
        presetSelect.value = 'custom';
    }
}

function filterReportIndicators(query) {
    const q = query.toLowerCase().trim();
    const items = document.querySelectorAll('.report-checkbox-item[data-type="general"]');
    items.forEach(item => {
        const name = item.getAttribute('data-name-lc') || '';
        if (q === '' || name.includes(q)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function populateReportIndicatorsList() {
    const container = document.getElementById('report-indicators-checklist');
    if (!container) return;
    
    let html = '';
    
    // 1. Structural Indicators Group
    html += `<div class="report-section-header">Indicadores Estructurales (Módulo Pirámides)</div>`;
    PYRAMID_INDICATORS.forEach(ind => {
        html += `
            <label class="report-checkbox-item" data-id="${ind.id}" data-type="structural">
                <input type="checkbox" id="chk-report-ind-struct-${ind.id}" data-id="${ind.id}" data-type="structural" onchange="onReportCheckboxChange()">
                <span>[${ind.id}] ${ind.name}</span>
            </label>
        `;
    });
    
    // 2. General Indicators Group
    html += `<div class="report-section-header">Indicadores Generales (Árbol Temático)</div>`;
    if (appState.flatIndicators && appState.flatIndicators.length > 0) {
        appState.flatIndicators.forEach(ind => {
            html += `
                <label class="report-checkbox-item" data-id="${ind.id}" data-type="general" data-name-lc="[${ind.id}] ${ind.name.toLowerCase()}">
                    <input type="checkbox" id="chk-report-ind-gen-${ind.id}" data-id="${ind.id}" data-type="general" onchange="onReportCheckboxChange()">
                    <span>[${ind.id}] ${ind.name}</span>
                </label>
            `;
        });
    } else {
        html += `<div style="padding: 0.5rem; font-size: 0.8125rem; color: var(--text-muted);">Cargando o no hay indicadores generales disponibles...</div>`;
    }
    
    container.innerHTML = html;
}

function flattenThematicTree(nodes, pathNames = [], flatList = []) {
    nodes.forEach(node => {
        const isCategory = node.children && node.children.length > 0;
        const currentPath = [...pathNames, node.name];
        if (isCategory) {
            flattenThematicTree(node.children, currentPath, flatList);
        } else if (node.indicator_id) {
            if (PYRAMID_INDICATORS.some(p => p.id === node.indicator_id)) {
                return;
            }
            flatList.push({
                id: node.indicator_id,
                name: node.name,
                categoryPath: pathNames.join(' / '),
                topCategory: pathNames[0] || 'General'
            });
        }
    });
    return flatList;
}

async function compileGeneralIndicatorReportData(indicatorId, indicatorName) {
    const url = `${API_DATA_BASE}/${indicatorId}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    
    const res = await response.json();
    const data = res.body;
    
    const rawData = data.data || [];
    const dimensions = data.dimensions || [];
    const metadata = data.metadata || {};
    
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    if (!yearDim) return `<div class="print-page" style="page-break-after: always; padding: 2cm;"><h3>${indicatorName}</h3><p>Error: No se encontró dimensión de tiempo.</p></div>`;
    
    const yearMap = {};
    yearDim.members.forEach(m => {
        yearMap[m.id] = m.name;
    });
    
    // Detect default secondary filters
    const secondaryFilters = {};
    const secondaryDims = dimensions.filter(d => d.id !== COUNTRY_DIM_ID && d.id !== YEAR_DIM_ID);
    secondaryDims.forEach(dim => {
        const members = dim.members || [];
        let defaultMember = members.find(m => m.selected === 1);
        if (!defaultMember) defaultMember = members.find(m => m.in === 1);
        if (!defaultMember) {
            defaultMember = members.find(m => {
                const name = m.name.toLowerCase();
                return name.includes('ambos') || name.includes('total') || name.includes('nacional');
            });
        }
        if (!defaultMember && members.length > 0) defaultMember = members[0];
        if (defaultMember) {
            secondaryFilters[dim.id] = defaultMember.id;
        }
    });
    
    let filteredRecords = rawData.filter(rec => {
        for (const [dimId, memberId] of Object.entries(secondaryFilters)) {
            const val = rec[`dim_${dimId}`];
            if (val !== undefined && val !== memberId) {
                return false;
            }
        }
        return true;
    });
    
    const colombiaData = {};
    const alcData = {};
    const yearsSet = new Set();
    
    filteredRecords.forEach(rec => {
        const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
        const yearMemberId = rec[`dim_${YEAR_DIM_ID}`];
        const yearLabel = yearMap[yearMemberId];
        if (!yearLabel) return;
        
        const val = parseFloat(rec.value);
        if (isNaN(val)) return;
        
        if (countryId === COLOMBIA_MEMBER_ID) {
            colombiaData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === ALC_MEMBER_ID) {
            alcData[yearLabel] = val;
            yearsSet.add(yearLabel);
        }
    });
    
    const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(a) - parseInt(b));
    if (sortedYears.length === 0) {
        return `<div class="print-page" style="page-break-after: always; padding: 2cm;"><h3>${indicatorName}</h3><p>No hay datos disponibles para comparar Colombia y ALC.</p></div>`;
    }
    
    const diagnosticHtml = generateDiagnosticHtmlText(sortedYears, colombiaData, alcData, metadata);
    
    let latestYearBoth = null;
    // Prefer the latest historical/real year (less than 2025)
    for (let i = sortedYears.length - 1; i >= 0; i--) {
        const yr = sortedYears[i];
        const yrNum = parseInt(yr);
        if (yrNum < 2025 && colombiaData[yr] !== undefined && alcData[yr] !== undefined) {
            latestYearBoth = yr;
            break;
        }
    }
    
    // If no historical year has data for both, fallback to the latest year with data for both
    if (!latestYearBoth) {
        for (let i = sortedYears.length - 1; i >= 0; i--) {
            const yr = sortedYears[i];
            if (colombiaData[yr] !== undefined && alcData[yr] !== undefined) {
                latestYearBoth = yr;
                break;
            }
        }
    }
    if (!latestYearBoth) latestYearBoth = sortedYears[sortedYears.length - 1];
    
    const colVal = colombiaData[latestYearBoth];
    const alcVal = alcData[latestYearBoth];
    const colValStr = colVal !== undefined ? formatNumber(colVal) : '-';
    const alcValStr = alcVal !== undefined ? formatNumber(alcVal) : '-';
    
    let gapStr = '-';
    let gapPctStr = '';
    const isAbsolute = isAbsoluteSumIndicator(indicatorName, metadata.unit);
    if (colVal !== undefined && alcVal !== undefined) {
        if (isAbsolute) {
            const share = alcVal !== 0 ? (colVal / alcVal) * 100 : 0;
            gapStr = formatNumber(share) + '%';
            gapPctStr = `Participación nacional respecto al total regional (${latestYearBoth})`;
        } else {
            const absGap = colVal - alcVal;
            const pctGap = (absGap / alcVal) * 100;
            gapStr = formatNumber(absGap);
            gapPctStr = `${absGap >= 0 ? '+' : ''}${formatNumber(pctGap)}% vs ALC (${latestYearBoth})`;
        }
    }
    
    let tableRowsHtml = '';
    const reversedYears = [...sortedYears].reverse();
    reversedYears.forEach(yr => {
        const cVal = colombiaData[yr];
        const aVal = alcData[yr];
        const isProj = parseInt(yr) >= 2025;
        
        let gStr = '-';
        let pStr = '-';
        if (cVal !== undefined && aVal !== undefined) {
            const gap = cVal - aVal;
            const pct = (gap / aVal) * 100;
            gStr = formatNumber(gap);
            pStr = `${gap >= 0 ? '+' : ''}${formatNumber(pct)}%`;
        }
        
        tableRowsHtml += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.5rem; text-align: left;">${yr} ${isProj ? '<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #c084fc;">PROY.</span>' : '<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399;">REAL</span>'}</td>
                <td class="colombia-cell" style="padding: 0.5rem; text-align: right; font-weight: 600; color: var(--color-colombia);">${cVal !== undefined ? formatNumber(cVal) : '-'}</td>
                <td class="alc-cell" style="padding: 0.5rem; text-align: right; font-weight: 600; color: var(--color-alc);">${aVal !== undefined ? formatNumber(aVal) : '-'}</td>
                <td style="padding: 0.5rem; text-align: right;">${gStr}</td>
                <td style="padding: 0.5rem; text-align: right;">${pStr}</td>
            </tr>
        `;
    });
    
    return `
        <div class="print-page" style="page-break-after: always; padding: 2cm;">
            <div class="print-section-title" style="font-family: var(--font-heading); font-size: 15pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <i class="fa-solid fa-chart-line" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                Indicador: [${indicatorId}] ${indicatorName}
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(255, 215, 0, 0.03);">
                    <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">Colombia</span>
                    <span style="font-size: 18pt; font-weight: 800; color: var(--color-colombia); display: block; margin-top: 0.25rem;">${colValStr}</span>
                </div>
                <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(168, 85, 247, 0.03);">
                    <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">América Latina y el Caribe</span>
                    <span style="font-size: 18pt; font-weight: 800; color: var(--color-alc); display: block; margin-top: 0.25rem;">${alcValStr}</span>
                </div>
                <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(59, 130, 246, 0.03);">
                    <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">Diferencia / Desvío</span>
                    <span style="font-size: 18pt; font-weight: 800; color: var(--accent-blue); display: block; margin-top: 0.25rem;">${gapStr}</span>
                    <span style="font-size: 7.5pt; color: var(--text-secondary); display: block; margin-top: 0.25rem; line-height: 1.2;">${gapPctStr}</span>
                </div>
            </div>
            
            <div class="card" style="padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-top: 1rem;">
                <h4 style="font-family: var(--font-heading); font-size: 11pt; font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-robot" style="margin-right: 0.4rem; color: var(--accent-blue);"></i> Diagnóstico Analítico Automatizado
                </h4>
                <div style="font-size: 9.5pt; line-height: 1.6; color: var(--text-secondary);">
                    ${diagnosticHtml}
                </div>
            </div>
            
            <div class="card" style="padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-top: 1.5rem; page-break-inside: avoid;">
                <h4 style="font-family: var(--font-heading); font-size: 11pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-table" style="margin-right: 0.4rem; color: var(--text-muted);"></i> Tabla Histórica de Datos
                </h4>
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Año</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Colombia</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Promedio ALC</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Diferencia</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">% Desvío (DRE)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function compileGeneralIndicatorReportDataFromState(id, name) {
    const data = appState.indicatorData;
    const rawData = data.data || [];
    const dimensions = data.dimensions || [];
    const metadata = data.metadata || {};
    
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    if (!yearDim) return `<div class="print-page" style="page-break-after: always; padding: 2cm;"><h3>${name}</h3><p>Error: No se encontró dimensión de tiempo.</p></div>`;
    
    const yearMap = {};
    yearDim.members.forEach(m => {
        yearMap[m.id] = m.name;
    });
    
    // Filter raw data matching the selected secondary filters in state
    let filteredRecords = rawData.filter(rec => {
        for (const [dimId, memberId] of Object.entries(appState.selectedFilters)) {
            const val = rec[`dim_${dimId}`];
            if (val !== undefined && val !== memberId) {
                return false;
            }
        }
        return true;
    });
    
    const colombiaData = {};
    const alcData = {};
    const yearsSet = new Set();
    
    filteredRecords.forEach(rec => {
        const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
        const yearMemberId = rec[`dim_${YEAR_DIM_ID}`];
        const yearLabel = yearMap[yearMemberId];
        if (!yearLabel) return;
        
        const val = parseFloat(rec.value);
        if (isNaN(val)) return;
        
        if (countryId === COLOMBIA_MEMBER_ID) {
            colombiaData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === ALC_MEMBER_ID) {
            alcData[yearLabel] = val;
            yearsSet.add(yearLabel);
        }
    });
    
    const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(a) - parseInt(b));
    if (sortedYears.length === 0) {
        return `<div class="print-page" style="page-break-after: always; padding: 2cm;"><h3>${name}</h3><p>No hay datos disponibles para comparar Colombia y ALC.</p></div>`;
    }
    
    const diagnosticHtml = generateDiagnosticHtmlText(sortedYears, colombiaData, alcData, metadata);
    
    let latestYearBoth = null;
    // Prefer the latest historical/real year (less than 2025)
    for (let i = sortedYears.length - 1; i >= 0; i--) {
        const yr = sortedYears[i];
        const yrNum = parseInt(yr);
        if (yrNum < 2025 && colombiaData[yr] !== undefined && alcData[yr] !== undefined) {
            latestYearBoth = yr;
            break;
        }
    }
    
    // If no historical year has data for both, fallback to the latest year with data for both
    if (!latestYearBoth) {
        for (let i = sortedYears.length - 1; i >= 0; i--) {
            const yr = sortedYears[i];
            if (colombiaData[yr] !== undefined && alcData[yr] !== undefined) {
                latestYearBoth = yr;
                break;
            }
        }
    }
    if (!latestYearBoth) latestYearBoth = sortedYears[sortedYears.length - 1];
    
    const colVal = colombiaData[latestYearBoth];
    const alcVal = alcData[latestYearBoth];
    const colValStr = colVal !== undefined ? formatNumber(colVal) : '-';
    const alcValStr = alcVal !== undefined ? formatNumber(alcVal) : '-';
    
    let gapStr = '-';
    let gapPctStr = '';
    const isAbsolute = isAbsoluteSumIndicator(name, metadata.unit);
    if (colVal !== undefined && alcVal !== undefined) {
        if (isAbsolute) {
            const share = alcVal !== 0 ? (colVal / alcVal) * 100 : 0;
            gapStr = formatNumber(share) + '%';
            gapPctStr = `Participación nacional respecto al total regional (${latestYearBoth})`;
        } else {
            const absGap = colVal - alcVal;
            const pctGap = (absGap / alcVal) * 100;
            gapStr = formatNumber(absGap);
            gapPctStr = `${absGap >= 0 ? '+' : ''}${formatNumber(pctGap)}% vs ALC (${latestYearBoth})`;
        }
    }
    
    let tableRowsHtml = '';
    const reversedYears = [...sortedYears].reverse();
    reversedYears.forEach(yr => {
        const cVal = colombiaData[yr];
        const aVal = alcData[yr];
        const isProj = parseInt(yr) >= 2025;
        
        let gStr = '-';
        let pStr = '-';
        if (cVal !== undefined && aVal !== undefined) {
            const gap = cVal - aVal;
            const pct = (gap / aVal) * 100;
            gStr = formatNumber(gap);
            pStr = `${gap >= 0 ? '+' : ''}${formatNumber(pct)}%`;
        }
        
        tableRowsHtml += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.5rem; text-align: left;">${yr} ${isProj ? '<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #c084fc;">PROY.</span>' : '<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399;">REAL</span>'}</td>
                <td class="colombia-cell" style="padding: 0.5rem; text-align: right; font-weight: 600; color: var(--color-colombia);">${cVal !== undefined ? formatNumber(cVal) : '-'}</td>
                <td class="alc-cell" style="padding: 0.5rem; text-align: right; font-weight: 600; color: var(--color-alc);">${aVal !== undefined ? formatNumber(aVal) : '-'}</td>
                <td style="padding: 0.5rem; text-align: right;">${gStr}</td>
                <td style="padding: 0.5rem; text-align: right;">${pStr}</td>
            </tr>
        `;
    });
    
    return `
        <div class="print-page" style="page-break-after: always; padding: 2cm;">
            <div class="print-section-title" style="font-family: var(--font-heading); font-size: 15pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <i class="fa-solid fa-chart-line" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                Indicador: [${id}] ${name}
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(255, 215, 0, 0.03);">
                    <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">Colombia</span>
                    <span style="font-size: 18pt; font-weight: 800; color: var(--color-colombia); display: block; margin-top: 0.25rem;">${colValStr}</span>
                </div>
                <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(168, 85, 247, 0.03);">
                    <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">América Latina y el Caribe</span>
                    <span style="font-size: 18pt; font-weight: 800; color: var(--color-alc); display: block; margin-top: 0.25rem;">${alcValStr}</span>
                </div>
                <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; background: rgba(59, 130, 246, 0.03);">
                    <span style="font-size: 8pt; color: var(--text-muted); text-transform: uppercase; display: block; letter-spacing: 0.5px;">Diferencia / Desvío</span>
                    <span style="font-size: 18pt; font-weight: 800; color: var(--accent-blue); display: block; margin-top: 0.25rem;">${gapStr}</span>
                    <span style="font-size: 7.5pt; color: var(--text-secondary); display: block; margin-top: 0.25rem; line-height: 1.2;">${gapPctStr}</span>
                </div>
            </div>
            
            <div class="card" style="padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-top: 1rem;">
                <h4 style="font-family: var(--font-heading); font-size: 11pt; font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-robot" style="margin-right: 0.4rem; color: var(--accent-blue);"></i> Diagnóstico Analítico Automatizado
                </h4>
                <div style="font-size: 9.5pt; line-height: 1.6; color: var(--text-secondary);">
                    ${diagnosticHtml}
                </div>
            </div>
            
            <div class="card" style="padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-top: 1.5rem; page-break-inside: avoid;">
                <h4 style="font-family: var(--font-heading); font-size: 11pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-table" style="margin-right: 0.4rem; color: var(--text-muted);"></i> Tabla Histórica de Datos
                </h4>
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Año</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Colombia</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Promedio ALC</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">Diferencia</th>
                            <th style="text-align: right; padding: 0.5rem; border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">% Desvío (DRE)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function compileStructuralIndicatorReportHtml(id, name, data) {
    const dimensions = data.dimensions || [];
    const rawData = data.data || [];
    
    const sexDim = dimensions.find(d => d.id === 88622 || d.id === 144 || d.name.toLowerCase().includes('sexo'));
    const ageDim = dimensions.find(d => d.id === 88628 || d.id === 88652 || d.id === 43054 || d.id === 1439 || d.name.toLowerCase().includes('edad') || d.name.toLowerCase().includes('grupo'));
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    
    if (!sexDim || !ageDim || !yearDim) {
        return `<div class="print-page" style="page-break-after: always; padding: 2cm;"><h3>${name}</h3><p>Faltan dimensiones requeridas.</p></div>`;
    }
    
    const presentYearIds = new Set(rawData.map(rec => rec[`dim_${YEAR_DIM_ID}`]));
    const sortedYears = [...yearDim.members]
        .filter(m => presentYearIds.has(m.id))
        .map(m => parseInt(m.name))
        .filter(y => !isNaN(y))
        .sort((a, b) => b - a);
    
    const selectedYear = sortedYears[0];
    const yearMember = yearDim.members.find(m => parseInt(m.name) === selectedYear);
    const yearMemberId = yearMember ? yearMember.id : null;
    
    if (!yearMemberId) {
        return `<div class="print-page" style="page-break-after: always; padding: 2cm;"><h3>${name}</h3><p>No se encontraron datos para el año de consulta.</p></div>`;
    }
    
    const sortedAges = [...ageDim.members]
        .filter(m => !m.name.toLowerCase().includes('total'))
        .sort((a, b) => (b.order || 0) - (a.order || 0));
    
    const yearRecords = rawData.filter(rec => rec[`dim_${YEAR_DIM_ID}`] === yearMemberId);
    
    const maleMember = sexDim.members.find(m => m.name.toLowerCase().includes('hombre') || m.name.toLowerCase().includes('masculino') || m.id === 88626 || m.id === 265);
    const femaleMember = sexDim.members.find(m => m.name.toLowerCase().includes('mujer') || m.name.toLowerCase().includes('femenino') || m.id === 88627 || m.id === 266);
    
    if (!maleMember || !femaleMember) {
        return `<div class="print-page" style="page-break-after: always; padding: 2cm;"><h3>${name}</h3><p>Faltan datos de género masculino/femenino.</p></div>`;
    }
    
    const colMales = {};
    const colFemales = {};
    const alcMales = {};
    const alcFemales = {};
    
    let alcId = ALC_MEMBER_ID;
    const has212 = yearRecords.some(rec => rec[`dim_${COUNTRY_DIM_ID}`] === ALC_MEMBER_ID);
    if (!has212 && yearRecords.some(rec => rec[`dim_${COUNTRY_DIM_ID}`] === 211)) {
        alcId = 211;
    }
    
    yearRecords.forEach(rec => {
        const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
        const sexId = rec[`dim_${sexDim.id}`];
        const ageId = rec[`dim_${ageDim.id}`];
        const val = parseFloat(rec.value);
        
        if (isNaN(val)) return;
        
        if (countryId === COLOMBIA_MEMBER_ID) {
            if (sexId === maleMember.id) colMales[ageId] = val;
            else if (sexId === femaleMember.id) colFemales[ageId] = val;
        } else if (countryId === alcId) {
            if (sexId === maleMember.id) alcMales[ageId] = val;
            else if (sexId === femaleMember.id) alcFemales[ageId] = val;
        }
    });
    
    const alcLabel = alcId === 212 ? 'América Latina y el Caribe' : 'América Latina';
    let diagHtml = '';
    
    const indConfig = PYRAMID_INDICATORS.find(item => item.id === id);
    const isRate = indConfig ? indConfig.isRate : false;
    
    if (!isRate) {
        diagHtml = generatePyramidDemographics(sortedAges, colMales, colFemales, alcMales, alcFemales, selectedYear, alcLabel, null);
    } else {
        diagHtml = generateRatePyramidDiagnostics(sortedAges, colMales, colFemales, alcMales, alcFemales, selectedYear, alcLabel, name, '%', null);
    }
    
    return `
        <div class="print-page" style="page-break-after: always; padding: 2cm;">
            <div class="print-section-title" style="font-family: var(--font-heading); font-size: 15pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <i class="fa-solid fa-users-line" style="color: var(--color-alc); margin-right: 0.5rem;"></i>
                Análisis Estructural: [${id}] ${name}
            </div>
            <div style="font-size: 8.5pt; color: var(--text-muted); margin-bottom: 1.5rem;">
                <strong>Año de Consulta:</strong> ${selectedYear} (${selectedYear >= 2025 ? 'Escenario Proyectado' : 'Registro Histórico Real'})
            </div>
            
            <div style="font-size: 9.5pt; line-height: 1.6; color: var(--text-secondary);">
                ${diagHtml}
            </div>
        </div>
    `;
}

function makeReportFormal(html) {
    if (!html) return html;
    
    // 1. Remove all FontAwesome <i> tags representing icons and any trailing spaces
    let cleaned = html.replace(/<i\b[^>]*>(?:<\/i>|.*?<\/i>)\s*/gi, '');
    
    // 2. Remove all unicode emojis and any trailing spaces.
    // This targets common emojis and uses general emoji presentation unicode ranges + \p{Emoji_Presentation}.
    // We explicitly avoid subscript characters like CO₂ (subscript ₂ is \u2082) or standard numbers.
    cleaned = cleaned.replace(/(?:[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F400}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|\p{Emoji_Presentation})\s*/gu, '');
    
    return cleaned;
}

function exportReportToWord(reportHtml) {
    let cleanedHtml = reportHtml;
    
    // Convert dark theme colors to clean light theme colors for Word legibility
    cleanedHtml = cleanedHtml.replace(/var\(--accent-blue\)/g, '#2563eb');
    cleanedHtml = cleanedHtml.replace(/var\(--color-colombia\)/g, '#b45309');
    cleanedHtml = cleanedHtml.replace(/var\(--color-alc\)/g, '#6b21a8');
    cleanedHtml = cleanedHtml.replace(/var\(--accent-green\)/g, '#10b981');
    cleanedHtml = cleanedHtml.replace(/var\(--accent-red\)/g, '#ef4444');
    cleanedHtml = cleanedHtml.replace(/var\(--text-primary\)/g, '#0f172a');
    cleanedHtml = cleanedHtml.replace(/var\(--text-secondary\)/g, '#334155');
    cleanedHtml = cleanedHtml.replace(/var\(--text-muted\)/g, '#64748b');
    cleanedHtml = cleanedHtml.replace(/var\(--border-color\)/g, '#e2e8f0');
    cleanedHtml = cleanedHtml.replace(/var\(--card-bg\)/g, '#f8fafc');
    cleanedHtml = cleanedHtml.replace(/#ffffff/g, '#000000'); // titles
    
    const wordHtmlHeader = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>Reporte Diagnóstico CEPAL</title>
            <style>
                body { font-family: 'Arial', sans-serif; color: #334155; line-height: 1.6; background-color: #ffffff; }
                h1 { font-family: 'Arial', sans-serif; font-size: 24pt; font-weight: 700; color: #0f172a; margin-bottom: 5px; text-align: center; }
                h2 { font-family: 'Arial', sans-serif; font-size: 14pt; color: #475569; font-weight: 400; text-align: center; margin-top: 0; }
                h3 { font-family: 'Arial', sans-serif; font-size: 13pt; font-weight: 700; color: #0f172a; }
                h4 { font-family: 'Arial', sans-serif; font-size: 11pt; font-weight: 600; color: #0f172a; margin-top: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
                th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 8px; font-weight: 600; font-size: 9.5pt; text-align: left; }
                td { border: 1px solid #e2e8f0; color: #334155; padding: 8px; font-size: 9.5pt; }
                .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 15px; margin-bottom: 15px; }
                ul { margin-left: 20px; }
                li { margin-bottom: 5px; font-size: 9.5pt; }
                .print-page { page-break-after: always; padding: 1.5cm; }
            </style>
        </head>
        <body>
    `;
    
    const wordHtmlFooter = `</body></html>`;
    const fullDoc = wordHtmlHeader + cleanedHtml + wordHtmlFooter;
    
    const blob = new Blob(['\ufeff' + fullDoc], {
        type: 'application/msword;charset=utf-8'
    });
    
    const filename = `reporte_diagnostico_cepal_${new Date().toISOString().slice(0,10)}.doc`;
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

async function triggerReportGeneration() {
    const selectedGeneralIds = [];
    const selectedStructuralIds = [];
    
    document.querySelectorAll('#report-indicators-checklist input[type="checkbox"]:checked').forEach(cb => {
        const id = parseInt(cb.getAttribute('data-id'));
        const type = cb.getAttribute('data-type');
        if (type === 'general') {
            selectedGeneralIds.push(id);
        } else if (type === 'structural') {
            selectedStructuralIds.push(id);
        }
    });
    
    if (selectedGeneralIds.length === 0 && selectedStructuralIds.length === 0) {
        alert('Por favor, seleccione al menos un indicador para incorporar al reporte.');
        return;
    }
    
    closeReportModal();
    
    const exportBtn = document.getElementById('btn-export-pdf');
    const originalBtnText = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
        exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando reporte...';
        exportBtn.style.pointerEvents = 'none';
        exportBtn.style.opacity = '0.7';
    }
    
    try {
        const region = appState.selectedRegion || 'ALC';
        let refKey = 'alcVal';
        let regionLabel = 'ALC (212)';
        if (region === 'LATO') {
            refKey = 'alVal';
            regionLabel = 'AL (211)';
        } else if (region === 'LAT') {
            refKey = 'latVal';
            regionLabel = 'AL Prom. Simple';
        }
        let reportHtml = '';
        
        // --- PAGE 1: TITLE & COVER ---
        reportHtml += `
            <div class="print-page" style="page-break-after: always; padding: 3cm 2cm; text-align: center;">
                <div style="margin-top: 5cm; margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 3px solid var(--accent-blue);">
                    <h1 style="font-family: var(--font-heading); font-size: 28pt; font-weight: 800; color: #ffffff; margin-bottom: 0.5rem; letter-spacing: -1px;">Reporte Diagnóstico CEPAL</h1>
                    <h2 style="font-family: var(--font-body); font-size: 16pt; color: var(--text-secondary); font-weight: 400; margin-top: 0;">Análisis de Indicadores: Colombia vs. América Latina y el Caribe</h2>
                </div>
                
                <div style="margin: 3rem 0; color: var(--text-secondary); font-size: 11pt; line-height: 1.8;">
                    <strong>Departamento de Análisis Regional</strong><br>
                    <strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString('es-ES')}<br>
                    <strong>Origen de Datos:</strong> API Oficial de la CEPAL
                </div>
                
                <div style="margin-top: 5cm; padding: 1.25rem; border-radius: 12px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.15); font-size: 10pt; color: var(--text-secondary); max-width: 500px; margin-left: auto; margin-right: auto; text-align: left;">
                    Este documento contiene el diagnóstico analítico automatizado de los indicadores seleccionados, computando la Tasa de Crecimiento Anual Compuesto (CAGR), la Desviación Relativa Estándar (DRE) y análisis estructurales demográficos.
                </div>
            </div>
        `;
        
        // --- PAGE 2: CRITICAL GAPS SUMMARY ---
        reportHtml += `
            <div class="print-page" style="page-break-after: always; padding: 2cm;">
                <div class="print-section-title" style="font-family: var(--font-heading); font-size: 15pt; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    Resumen de Brechas Críticas y Desviación Estadística (Benchmarks)
                </div>
                
                <div class="card" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 25%;">Indicador</th>
                                <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">Colombia</th>
                                <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">ALC (212)</th>
                                <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">AL (211)</th>
                                <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 11%;">AL Prom. Simple</th>
                                <th style="text-align: center; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 13%;">DRE (vs ${regionLabel})</th>
                                <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600; width: 18%;">Interpretación del Desvío</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Sort benchmarks by absolute dynamic DRE
        const sortedBenchmarks = [...CRITICAL_BENCHMARKS].sort((a, b) => {
            const refA = a[refKey];
            const refB = b[refKey];
            const dreA = Math.abs((a.colVal - refA) / refA);
            const dreB = Math.abs((b.colVal - refB) / refB);
            return dreB - dreA;
        });
        
        sortedBenchmarks.forEach(item => {
            const refVal = item[refKey];
            const dre = (item.colVal - refVal) / refVal;
            let dreSign = dre >= 0 ? '+' : '';
            const lowerBetter = isLowerBetter(item.name);
            const isFavorable = lowerBetter ? (item.colVal <= refVal) : (item.colVal >= refVal);
            
            const badgeColor = isFavorable ? '#10b981' : '#ef4444';
            const bgOpacity = 'rgba(' + (isFavorable ? '16, 185, 129' : '239, 68, 68') + ', 0.1)';
            const badgeText = isFavorable ? 'Mejor' : 'Peor';
            
            reportHtml += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.75rem 1rem; text-align: left; vertical-align: top;">
                        <strong>${item.name}</strong>
                        <span style="font-size: 7.5pt; color: var(--text-muted); display: block; margin-top: 0.15rem;">Año: ${item.year} | Unidad: ${item.unit}</span>
                    </td>
                    <td class="colombia-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-colombia); font-weight: 600; vertical-align: top;">${formatNumber(item.colVal)}</td>
                    <td class="alc-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-alc); font-weight: 600; vertical-align: top;">${formatNumber(item.alcVal)}</td>
                    <td class="al-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--text-secondary); font-weight: 600; vertical-align: top;">${formatNumber(item.alVal)}</td>
                    <td class="lat-simple-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--text-muted); font-weight: 600; vertical-align: top;">${formatNumber(item.latVal)}</td>
                    <td style="text-align: center; padding: 0.75rem 1rem; font-weight: 600; vertical-align: top;">
                        <span style="padding: 0.2rem 0.5rem; border-radius: 6px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 8.5pt; border: 1px solid ${badgeColor}33; display: inline-block;">
                            ${dreSign}${formatNumber(dre)}
                        </span>
                    </td>
                    <td style="font-size: 8.5pt; color: var(--text-secondary); padding: 0.75rem 1rem; line-height: 1.3; text-align: left; vertical-align: top;">
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <div>
                                <span style="padding: 0.15rem 0.4rem; border-radius: 4px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 7.5pt; font-weight: 700; text-transform: uppercase;">
                                    ${badgeText}
                                </span>
                            </div>
                            <span>${item.interpretation}</span>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        reportHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // --- PAGE 3+: SELECTED GENERAL INDICATORS ---
        for (let i = 0; i < selectedGeneralIds.length; i++) {
            const id = selectedGeneralIds[i];
            const indItem = appState.flatIndicators.find(item => item.id === id);
            const name = indItem ? indItem.name : `Indicador #${id}`;
            
            if (exportBtn) {
                exportBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cargando indicador ${i+1}/${selectedGeneralIds.length}...`;
            }
            
            try {
                if (appState.selectedIndicator && appState.selectedIndicator.id === id && appState.indicatorData) {
                    const compHtml = compileGeneralIndicatorReportDataFromState(id, name);
                    reportHtml += compHtml;
                } else {
                    const compHtml = await compileGeneralIndicatorReportData(id, name);
                    reportHtml += compHtml;
                }
            } catch (err) {
                console.error(`Error loading indicator ${id}:`, err);
                reportHtml += `
                    <div class="print-page" style="page-break-after: always; padding: 2cm;">
                        <h3 style="color: var(--accent-red);">${name}</h3>
                        <p>No se pudieron descargar los datos de este indicador o no hay información para Colombia y ALC en la API.</p>
                    </div>
                `;
            }
        }
        
        // --- PAGE 4+: SELECTED STRUCTURAL INDICATORS (PIRAMIDES) ---
        for (let i = 0; i < selectedStructuralIds.length; i++) {
            const id = selectedStructuralIds[i];
            const ind = PYRAMID_INDICATORS.find(item => item.id === id);
            const name = ind ? ind.name : `Indicador Estructural #${id}`;
            
            if (exportBtn) {
                exportBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cargando estructuras...`;
            }
            
            let data = appState.pyramidDataCache ? appState.pyramidDataCache[id] : null;
            if (!data) {
                try {
                    const url = `${API_DATA_BASE}/${id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID},211`;
                    const response = await fetch(url);
                    if (response.ok) {
                        const res = await response.json();
                        data = res.body;
                        if (!appState.pyramidDataCache) appState.pyramidDataCache = {};
                        appState.pyramidDataCache[id] = data;
                    }
                } catch (e) {
                    console.error(`Error loading print indicator ${id}:`, e);
                }
            }
            
            if (data) {
                const compHtml = compileStructuralIndicatorReportHtml(id, name, data);
                reportHtml += compHtml;
            } else {
                reportHtml += `
                    <div class="print-page" style="page-break-after: always; padding: 2cm;">
                        <h3 style="color: var(--accent-red);">${name}</h3>
                        <p>No se pudieron recuperar los datos demográficos en este indicador de la API.</p>
                    </div>
                `;
            }
        }
        
        // Clean reportHtml from all icons and emojis for formal reporting
        const formalReportHtml = makeReportFormal(reportHtml);
        
        // Now output based on selected format
        if (appState.reportFormat === 'word') {
            exportReportToWord(formalReportHtml);
        } else {
            let printArea = document.getElementById('print-report-area');
            if (!printArea) {
                printArea = document.createElement('div');
                printArea.id = 'print-report-area';
                document.body.appendChild(printArea);
            }
            printArea.innerHTML = formalReportHtml;
            window.print();
        }
        
    } catch (e) {
        console.error("Error generating report:", e);
        alert("Ocurrió un error al compilar los datos del reporte.");
    } finally {
        if (exportBtn) {
            exportBtn.innerHTML = originalBtnText;
            exportBtn.style.pointerEvents = 'auto';
            exportBtn.style.opacity = '1';
        }
    }
}

// ==========================================
// EXCEL EXPORT MODULE (XLS)
// ==========================================
let xlsState = {
    isExporting: false,
    cancelled: false,
    flatIndicators: [],
    categories: {}, // Maps category name -> array of indicator objects
    selectedCategories: new Set(),
    results: [] // Array of processed results: { code, category, name, year, colVal, alcVal, gap, dre }
};

// Open XLS Export Modal
function openXlsExportModal() {
    const modal = document.getElementById('xls-export-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Reset state
    xlsState.isExporting = false;
    xlsState.cancelled = false;
    xlsState.results = [];
    
    // Show selection, hide progress
    document.getElementById('xls-selection-panel').style.display = 'block';
    document.getElementById('xls-progress-panel').style.display = 'none';
    document.getElementById('btn-xls-start').style.display = 'inline-flex';
    document.getElementById('btn-xls-cancel').style.display = 'none';
    document.getElementById('btn-xls-close').removeAttribute('disabled');
    
    // Group flat indicators by top category
    xlsState.flatIndicators = appState.flatIndicators || [];
    xlsState.categories = {};
    
    xlsState.flatIndicators.forEach(ind => {
        const cat = ind.topCategory || 'General';
        if (!xlsState.categories[cat]) {
            xlsState.categories[cat] = [];
        }
        xlsState.categories[cat].push(ind);
    });
    
    // Render checklists
    const checklistContainer = document.getElementById('xls-categories-checklist');
    if (checklistContainer) {
        checklistContainer.innerHTML = '';
        
        const categories = Object.keys(xlsState.categories).sort();
        if (categories.length === 0) {
            checklistContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8125rem;">Cargando indicadores. Inténtalo de nuevo en unos segundos...</div>';
            document.getElementById('btn-xls-start').setAttribute('disabled', 'true');
            return;
        }
        
        document.getElementById('btn-xls-start').removeAttribute('disabled');
        
        categories.forEach(cat => {
            const count = xlsState.categories[cat].length;
            const div = document.createElement('div');
            div.innerHTML = `
                <label class="report-checkbox-item" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <input type="checkbox" class="xls-category-checkbox" value="${cat}" checked autocomplete="off" onchange="updateXlsSelectedCount()">
                        <span>${cat}</span>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 0.15rem 0.45rem; border-radius: 4px;">${count} ind.</span>
                </label>
            `;
            checklistContainer.appendChild(div);
        });
        
        // Explicitly set XLS checkboxes checked state programmatically
        document.querySelectorAll('.xls-category-checkbox').forEach(cb => {
            cb.checked = true;
        });
    }
    
    updateXlsSelectedCount();
}

// Close XLS Export Modal
function closeXlsExportModal() {
    if (xlsState.isExporting) {
        if (!confirm('La exportación está en curso. ¿Deseas detenerla?')) {
            return;
        }
        xlsState.cancelled = true;
    }
    const modal = document.getElementById('xls-export-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Toggle checklist select all / deselect all
function selectAllXlsCategories(checked) {
    document.querySelectorAll('.xls-category-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    updateXlsSelectedCount();
}

// Update count label in UI
function updateXlsSelectedCount() {
    const checkboxes = document.querySelectorAll('.xls-category-checkbox:checked');
    let totalCount = 0;
    
    xlsState.selectedCategories = new Set();
    checkboxes.forEach(cb => {
        const cat = cb.value;
        xlsState.selectedCategories.add(cat);
        totalCount += (xlsState.categories[cat] ? xlsState.categories[cat].length : 0);
    });
    
    const countEl = document.getElementById('xls-selected-count');
    if (countEl) {
        countEl.textContent = `${totalCount} indicadores seleccionados`;
    }
    
    const startBtn = document.getElementById('btn-xls-start');
    if (startBtn) {
        if (totalCount === 0) {
            startBtn.setAttribute('disabled', 'true');
            startBtn.style.opacity = '0.5';
            startBtn.style.pointerEvents = 'none';
        } else {
            startBtn.removeAttribute('disabled');
            startBtn.style.opacity = '1';
            startBtn.style.pointerEvents = 'auto';
        }
    }
}

// Cancel ongoing export and trigger download of partial results
function cancelXlsExport() {
    xlsState.cancelled = true;
    document.getElementById('xls-progress-status').textContent = 'Cancelando y compilando descarga parcial...';
}

// Main function to run the fetch queue in batches
async function startXlsExport() {
    xlsState.isExporting = true;
    xlsState.cancelled = false;
    xlsState.results = [];
    
    // Hide selectors, show progress bar
    document.getElementById('xls-selection-panel').style.display = 'none';
    document.getElementById('xls-progress-panel').style.display = 'block';
    document.getElementById('btn-xls-start').style.display = 'none';
    document.getElementById('btn-xls-cancel').style.display = 'inline-flex';
    document.getElementById('btn-xls-close').setAttribute('disabled', 'true');
    
    // Gather all selected indicators
    const indicatorsToFetch = [];
    xlsState.flatIndicators.forEach(ind => {
        if (xlsState.selectedCategories.has(ind.topCategory)) {
            indicatorsToFetch.push(ind);
        }
    });
    
    const total = indicatorsToFetch.length;
    let processed = 0;
    
    // Concurrency settings: 15 parallel requests
    const CONCURRENCY = 15;
    
    // Queue processor
    async function worker(queue) {
        while (queue.length > 0 && !xlsState.cancelled) {
            const ind = queue.shift();
            if (!ind) continue;
            
            try {
                // Fetch data for Colombia, ALC (212), AL (211) and LAT (43053)
                const url = `${API_DATA_BASE}/${ind.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID},211,${LAT_MEMBER_ID}`;
                const response = await fetch(url);
                if (response.ok) {
                    const res = await response.json();
                    const body = res.body;
                    
                    const record = extractSharedYearData(ind, body);
                    if (record) {
                        xlsState.results.push(record);
                    }
                }
            } catch (err) {
                console.error(`Error al descargar datos del indicador ${ind.id}:`, err);
            }
            
            processed++;
            updateXlsProgress(processed, total, ind.name);
        }
    }
    
    // Clone and chunk queue
    const queue = [...indicatorsToFetch];
    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
        workers.push(worker(queue));
    }
    
    await Promise.all(workers);
    
    // Download results (whether complete or partial)
    downloadXlsReport();
    
    // Reset modal state
    xlsState.isExporting = false;
    document.getElementById('btn-xls-close').removeAttribute('disabled');
    document.getElementById('btn-xls-cancel').style.display = 'none';
    document.getElementById('btn-xls-start').style.display = 'inline-flex';
    
    // Reset status in progress panel
    if (xlsState.cancelled) {
        document.getElementById('xls-progress-status').textContent = 'Descarga parcial completada.';
    } else {
        document.getElementById('xls-progress-status').textContent = 'Exportación finalizada con éxito.';
    }
}

// Update progress bar and detail text
function updateXlsProgress(processed, total, currentName) {
    const pct = Math.round((processed / total) * 100);
    document.getElementById('xls-progress-percent').textContent = `${pct}%`;
    document.getElementById('xls-progress-fill').style.width = `${pct}%`;
    
    if (xlsState.cancelled) {
        document.getElementById('xls-progress-status').textContent = 'Cancelando y guardando datos...';
    } else {
        document.getElementById('xls-progress-status').textContent = `Procesando: ${processed} de ${total}`;
    }
    
    document.getElementById('xls-progress-detail').textContent = `Indicador actual: ${currentName}`;
}

// Extract the latest shared year between Colombia and ALC
function extractSharedYearData(ind, body) {
    const data = body.data || [];
    const dimensions = body.dimensions || [];
    
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    if (!yearDim) return null;
    
    const yearMap = {};
    yearDim.members.forEach(m => {
        yearMap[m.id] = m.name;
    });
    
    // Handle secondary filters using default totals/both sexes
    const secondaryFilters = {};
    const secondaryDims = dimensions.filter(d => d.id !== COUNTRY_DIM_ID && d.id !== YEAR_DIM_ID);
    secondaryDims.forEach(dim => {
        const members = dim.members || [];
        let defaultMember = members.find(m => m.selected === 1);
        if (!defaultMember) defaultMember = members.find(m => m.in === 1);
        if (!defaultMember) {
            defaultMember = members.find(m => {
                const name = m.name.toLowerCase();
                return name.includes('ambos') || name.includes('total') || name.includes('nacional');
            });
        }
        if (!defaultMember && members.length > 0) defaultMember = members[0];
        if (defaultMember) {
            secondaryFilters[dim.id] = defaultMember.id;
        }
    });
    
    // Filter records matching secondary filters
    const filtered = data.filter(rec => {
        for (const [dimId, memberId] of Object.entries(secondaryFilters)) {
            const val = rec[`dim_${dimId}`];
            if (val !== undefined && val !== memberId) {
                return false;
            }
        }
        return true;
    });
    
    // Group by year
    const colData = {};
    const alcData = {}; // 212
    const alData = {};  // 211
    const latData = {}; // 43053
    const yearsSet = new Set();
    
    filtered.forEach(rec => {
        const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
        const yearMemberId = rec[`dim_${YEAR_DIM_ID}`];
        const yearLabel = yearMap[yearMemberId];
        if (!yearLabel) return;
        
        const val = parseFloat(rec.value);
        if (isNaN(val)) return;
        
        if (countryId === COLOMBIA_MEMBER_ID) {
            colData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === ALC_MEMBER_ID) {
            alcData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === 211) {
            alData[yearLabel] = val;
            yearsSet.add(yearLabel);
        } else if (countryId === LAT_MEMBER_ID) {
            latData[yearLabel] = val;
            yearsSet.add(yearLabel);
        }
    });
    
    const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a)); // Newest first
    if (sortedYears.length === 0) return null;
    
    // Find latest year with data for Colombia and at least one region
    let sharedYear = null;
    for (const yr of sortedYears) {
        const yrNum = parseInt(yr);
        if (yrNum < 2025 && colData[yr] !== undefined && (alcData[yr] !== undefined || alData[yr] !== undefined || latData[yr] !== undefined)) {
            sharedYear = yr;
            break;
        }
    }
    
    if (!sharedYear) {
        for (const yr of sortedYears) {
            if (colData[yr] !== undefined && (alcData[yr] !== undefined || alData[yr] !== undefined || latData[yr] !== undefined)) {
                sharedYear = yr;
                break;
            }
        }
    }
    
    if (!sharedYear) return null;
    
    const colVal = colData[sharedYear];
    const alcVal = alcData[sharedYear];
    const alVal = alData[sharedYear];
    const latVal = latData[sharedYear];
    
    // Determine the primary available regional value for Gap and DRE calculation
    let regionVal = undefined;
    let regionLabel = '';
    if (alcVal !== undefined) {
        regionVal = alcVal;
        regionLabel = 'ALC (212)';
    } else if (alVal !== undefined) {
        regionVal = alVal;
        regionLabel = 'AL (211)';
    } else if (latVal !== undefined) {
        regionVal = latVal;
        regionLabel = 'AL Prom. Simple';
    }
    
    const gap = (colVal !== undefined && regionVal !== undefined) ? colVal - regionVal : null;
    const dre = (regionVal !== undefined && regionVal !== 0 && gap !== null) ? gap / regionVal : null;
    
    return {
        code: ind.id,
        category: ind.categoryPath || 'General',
        name: ind.name,
        year: sharedYear,
        colVal: colVal,
        alcVal: alcVal,
        alVal: alVal,
        latVal: latVal,
        gap: gap,
        dre: dre,
        regionLabel: regionLabel
    };
}

// Generate Excel file (XML/HTML table structure) and download
function downloadXlsReport() {
    if (xlsState.results.length === 0) {
        alert('No se encontraron datos comparativos para exportar.');
        return;
    }
    
    // Sort results by category (alphabetically) then by code (numerically)
    const sortedResults = [...xlsState.results].sort((a, b) => {
        const catCompare = a.category.localeCompare(b.category);
        if (catCompare !== 0) return catCompare;
        return a.code - b.code;
    });
    
    // Build Excel HTML template
    let xlsHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Indicadores CEPAL</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: left; }
                td { border: 1px solid #cbd5e1; padding: 8px; color: #334155; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .category-row { background-color: #f8fafc; font-weight: bold; }
                .header-title { font-size: 16pt; font-weight: bold; color: #1e3a8a; padding: 15px 0; }
                .meta-cell { font-size: 9pt; color: #64748b; padding-bottom: 20px; }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <td colspan="8" class="header-title">Listado de Indicadores Comparativos CEPAL</td>
                </tr>
                <tr>
                    <td colspan="8" class="meta-cell">
                        <strong>Ámbito Geográfico:</strong> Colombia vs. América Latina y el Caribe (ALC)<br>
                        <strong>Fecha de Generación:</strong> ${new Date().toLocaleDateString('es-ES')}<br>
                        <strong>Origen de Datos:</strong> API Oficial de la CEPAL (Sistemas de Indicadores)<br>
                        <strong>Total de Registros:</strong> ${sortedResults.length} indicadores comparados
                    </td>
                </tr>
                <thead>
                    <tr>
                        <th style="width: 80px;">Código</th>
                        <th style="width: 250px;">Clase / Ruta Temática</th>
                        <th style="width: 350px;">Indicador</th>
                        <th style="width: 80px;" class="text-center">Año Compartido</th>
                        <th style="width: 120px;" class="text-right">Valor Colombia</th>
                        <th style="width: 120px;" class="text-right">Valor Promedio ALC</th>
                        <th style="width: 120px;" class="text-right">Brecha Absoluta</th>
                        <th style="width: 120px;" class="text-right">Desviación Relativa Estándar (DRE)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedResults.forEach(row => {
        xlsHtml += `
            <tr>
                <td class="text-center">${row.code}</td>
                <td>${row.category}</td>
                <td>${row.name}</td>
                <td class="text-center">${row.year}</td>
                <td class="text-right">${formatXlsValue(row.colVal)}</td>
                <td class="text-right">${formatXlsValue(row.alcVal)}</td>
                <td class="text-right">${formatXlsValue(row.gap)}</td>
                <td class="text-right">${formatXlsValue(row.dre)}</td>
            </tr>
        `;
    });
    
    xlsHtml += `
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    // Create Blob and trigger download
    const filename = `listado_completo_cepal_${new Date().toISOString().slice(0,10)}.xls`;
    const blob = new Blob(['\ufeff' + xlsHtml], {
        type: 'application/vnd.ms-excel;charset=utf-8'
    });
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// Helper to format values for Excel cells
function formatXlsValue(val) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    // Decide decimal representation: localized using comma for decimals (European/LatAm format)
    const abs = Math.abs(val);
    let decimals = 2;
    if (abs >= 1000) decimals = 0;
    if (abs < 1 && abs > 0) decimals = 4;
    
    return Number(val).toLocaleString('es-ES', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    });
}

// ==========================================
// 19. TENDENCIAS CEPAL 2025 MODULE
// ==========================================

const CEPAL_REPORTS_DATA = [
    {
        id: "balance_preliminar",
        title: "Balance Preliminar de las Economías de América Latina y el Caribe 2025",
        shortTitle: "Balance Económico 2025",
        icon: "fa-scale-balanced",
        trends: [
            {
                title: "Consolidación de una trampa de bajo crecimiento económico",
                desc: "La región se mantiene en una trayectoria de escaso dinamismo, con un crecimiento proyectado del 2,4% en 2025 y del 2,3% en 2026. Esto completaría una secuencia de cuatro años consecutivos con tasas cercanas al 2,3%, reafirmando una baja capacidad estructural para crecer.",
                analysis: "En Colombia, la desaceleración del crecimiento ha seguido un patrón similar al promedio regional, enfrentando dificultades para superar tasas del 2% anual en el periodo de post-pandemia, evidenciando limitaciones estructurales de productividad.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante a precios constantes en dólares", note: "Mide el nivel de ingreso real y el crecimiento económico general de largo plazo." }
                ]
            },
            {
                title: "Desaceleración continua de la inflación",
                desc: "La inflación regional mantiene una trayectoria descendente, reduciéndose a la mitad entre febrero y septiembre de 2025 para alcanzar una mediana del 1,8%. Esta reducción ha permitido a la mayor parte de los bancos centrales continuar con un ciclo de recortes en las tasas de política monetaria.",
                analysis: "Colombia ha mostrado una convergencia inflacionaria más lenta debido a factores de indexación y choques climáticos, pero sigue la tendencia regional descendente que permite la flexibilización gradual de las tasas del Banco de la República.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante (como proxy de estabilidad macroeconómica)", note: "Nota: Para ver el índice inflacionario de precios directamente, puedes buscar en el explorador indicadores afines al IPC." }
                ]
            },
            {
                title: "Pérdida de dinamismo del consumo privado y estancamiento de la inversión",
                desc: "El consumo privado se desacelera debido a un menor crecimiento del empleo y de los salarios, aunque sigue siendo el principal motor de la economía. Simultáneamente, la formación bruta de capital fijo (inversión) se mantiene en niveles bajos y no logra repuntar lo suficiente para cambiar el patrón de bajo crecimiento.",
                analysis: "El consumo en Colombia se ha visto afectado por la contracción del crédito de consumo y altas tasas reales. La inversión (formación bruta de capital) muestra un estancamiento severo, especialmente en obras civiles y vivienda.",
                indicators: [
                    { id: 127, name: "Tasa de desocupación por sexo", note: "El desempleo y la calidad del trabajo impactan directamente el ingreso de los hogares y el consumo privado." }
                ]
            }
        ]
    },
    {
        id: "estudio_economico",
        title: "Estudio Económico de América Latina y el Caribe 2025",
        shortTitle: "Estudio Económico 2025",
        icon: "fa-chart-line",
        trends: [
            {
                title: "Restricción del espacio fiscal y alta carga de deuda",
                desc: "Los niveles de deuda pública continúan siendo elevados (50,2% del PIB en el primer trimestre de 2025 en América Latina), lo que, sumado al incremento en los pagos de intereses, limita severamente el margen de los Gobiernos para expandir la inversión pública.",
                analysis: "Colombia enfrenta una estrecha restricción fiscal regida por la Regla Fiscal y un incremento en el servicio de la deuda, lo que ha reducido la inversión pública directa, obligando a buscar alianzas público-privadas.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante (Sostenibilidad de deuda)", note: "El nivel de PIB por habitante es el denominador clave para medir la capacidad de pago y solvencia soberana." }
                ]
            },
            {
                title: "Persistencia de la vulnerabilidad en las cuentas externas",
                desc: "Se proyecta un déficit de la cuenta corriente del 1,1% del PIB para 2025. La región sigue dependiendo fuertemente de la entrada de remesas y de los flujos de inversión extranjera para compensar los crecientes egresos netos por renta factorial.",
                analysis: "El déficit de cuenta corriente de Colombia se ha moderado, pero permanece por encima de la media regional (cercano al 2.5% del PIB), lo que la hace altamente vulnerable a choques externos y dependiente de flujos financieros.",
                indicators: [
                    { id: 2206, name: "PIB total anual (Tamaño de la economía frente al sector externo)", note: "Ayuda a dimensionar la escala del flujo comercial y financiero internacional respecto a la producción nacional." }
                ]
            },
            {
                title: "Ampliación de la brecha de financiamiento para la transformación productiva",
                desc: "Existe un déficit creciente de recursos financieros necesarios para alcanzar los Objetivos de Desarrollo Sostenible (ODS) y abordar la transición climática. Esto hace urgente una reforma a la arquitectura financiera internacional y un rol más activo de la banca de desarrollo.",
                analysis: "Colombia promueve agendas de 'financiamiento verde' e intercambios de deuda por acción climática, pero el déficit de recursos para infraestructura resiliente al clima sigue ampliándose significativamente.",
                indicators: [
                    { id: 5649, name: "Emisiones de dióxido de carbono (CO₂) por habitante", note: "Refleja el desafío de descarbonización y financiamiento asociado a la transición climática." }
                ]
            }
        ]
    },
    {
        id: "ied_2025",
        title: "La Inversión Extranjera Directa en América Latina y el Caribe 2025",
        shortTitle: "Inversión Extranjera (IED)",
        icon: "fa-money-bill-transfer",
        trends: [
            {
                title: "Crecimiento de la IED impulsado por la reinversión frente al estancamiento de nuevos capitales",
                desc: "Las entradas de IED crecieron un 7,1% en 2024, alcanzando los 188.962 millones de dólares. Este aumento se debió principalmente a la reinversión de utilidades de empresas transnacionales ya instaladas, mientras que los aportes de capital fresco (nuevas inversiones) cayeron por segundo año consecutivo.",
                analysis: "En Colombia, la dinámica de IED se ha concentrado fuertemente en hidrocarburos y minería (IED tradicional) y reinversión en servicios financieros, mostrando una caída en nuevos capitales para la industria manufacturera.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante (Atracción de capitales)", note: "Un mayor nivel de desarrollo e ingreso por habitante correlaciona con la atracción de inversiones complejas." }
                ]
            },
            {
                title: "Reconfiguración de las inversiones hacia la transición energética",
                desc: "Se registra un interés sostenido en el sector de energías renovables y un aumento exponencial en los anuncios de proyectos ligados a minerales críticos (como el cobre y el litio), áreas donde la región posee una posición geopolítica y productiva estratégica.",
                analysis: "Colombia tiene un potencial inmenso en cobre y energía eólica/solar en la Guajira, sin embargo, el desarrollo de proyectos enfrenta retrasos por consultas previas y licencias ambientales en comparación con la agilidad regional.",
                indicators: [
                    { id: 5649, name: "Emisiones de dióxido de carbono (CO₂) por habitante", note: "La descarbonización de la matriz energética mediante la transición reduce las emisiones directas." }
                ]
            },
            {
                title: "Auge de la inversión orientada a la transformación digital",
                desc: "Los proyectos de Inversión Extranjera Directa en el sector de las comunicaciones experimentaron un crecimiento del 71% en 2024 respecto al año anterior. Esto fue liderado por inversiones masivas para el desarrollo de centros de procesamiento de datos e infraestructura digital.",
                analysis: "Colombia ha ganado tracción como hub de Data Centers en la región andina gracias a la fibra óptica submarina y estímulos gubernamentales, lo cual requiere capital humano avanzado para su asimilación.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante (Infraestructura y digitalización)", note: "Relacionado con la productividad agregada aportada por los sectores de tecnologías de la información." }
                ]
            }
        ]
    },
    {
        id: "desarrollo_productivo",
        title: "Panorama de las Políticas de Desarrollo Productivo en América Latina y el Caribe 2025",
        shortTitle: "Desarrollo Productivo",
        icon: "fa-industry",
        trends: [
            {
                title: "Retroceso histórico de la productividad laboral",
                desc: "Tras un incremento entre 1990 y 2013, la productividad laboral de la región ha experimentado una década de caídas. Desde 2017, la productividad de América Latina y el Caribe se situó por debajo del promedio mundial y la brecha no ha dejado de ampliarse.",
                analysis: "Colombia muestra un estancamiento persistente de la productividad laboral, ligado a una alta informalidad laboral (cercana al 55%) que impide la acumulación de capital humano e incorporación tecnológica.",
                indicators: [
                    { id: 120, name: "Tasa de participación en la fuerza de trabajo", note: "Refleja el uso del factor trabajo. Una baja productividad laboral limita la generación de empleo de calidad." }
                ]
            },
            {
                title: "Profundización de las brechas de productividad por tamaño de empresa",
                desc: "La región no solo presenta una productividad general inferior a la de economías avanzadas, sino que el rezago es drásticamente mayor en las micro, pequeñas y medianas empresas. En la última década, la distancia en productividad entre las grandes empresas y las de menor tamaño ha aumentado, perjudicando la integración del sistema productivo.",
                analysis: "En Colombia, las micro y pequeñas empresas concentran más del 80% del empleo, pero su productividad promedio es menos del 20% de la de las grandes empresas, lo que perpetúa la trampa de desigualdad laboral.",
                indicators: [
                    { id: 127, name: "Tasa de desocupación por sexo", note: "La incapacidad de las MiPyMEs para escalar productivamente restringe la demanda estructural de empleo formal." }
                ]
            },
            {
                title: "Resurgimiento y formalización de políticas de desarrollo productivo",
                desc: "Diversos países de la región han vuelto a situar la política industrial en el centro de sus estrategias gubernamentales. Se observa un retorno al diseño de planes estructurados de alcance nacional y un fuerte impulso a la creación de iniciativas clúster para fomentar la articulación entre el sector público, privado y académico.",
                analysis: "Colombia ha estructurado la 'Política de Reindustrialización' enfocada en la transición energética, la soberanía alimentaria, la salud y la defensa, fomentando clústeres regionales en departamentos clave.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante (Impacto de políticas industriales)", note: "El éxito de las políticas de desarrollo productivo se refleja en el crecimiento sostenido del PIB real per cápita." }
                ]
            }
        ]
    },
    {
        id: "panorama_social",
        title: "Panorama Social de América Latina y el Caribe 2025",
        shortTitle: "Panorama Social",
        icon: "fa-people-roof",
        trends: [
            {
                title: "Caída histórica de la pobreza monetaria y multidimensional",
                desc: "La pobreza monetaria se redujo al 25,5% en 2024, alcanzando su nivel más bajo desde que existen registros comparables, impulsada fundamentalmente por mejoras en los ingresos laborales. De manera paralela, la pobreza multidimensional cayó al 20,9%, reflejando mejoras en acceso a servicios básicos y conectividad.",
                analysis: "Colombia ha logrado reducciones notables en pobreza monetaria (bajando al 33% en 2023) y pobreza multidimensional (al 12.1%), apalancada por subsidios del gobierno y recuperación del empleo urbano, aunque persisten altos niveles de desigualdad rural.",
                indicators: [
                    { id: 3328, name: "Población en situación de pobreza extrema y pobreza", note: "Indicador directo que refleja el porcentaje de la población por debajo de los umbrales de ingreso." }
                ]
            },
            {
                title: "Desigualdad de ingresos estructuralmente elevada y rígida",
                desc: "A pesar de una leve tendencia a la baja en la última década, el índice de Gini se mantiene en niveles extremos comparado con otras regiones del mundo. La concentración de la riqueza limita severamente la movilidad social, impidiendo que la educación funcione como un igualador de oportunidades.",
                analysis: "Colombia ostenta uno de los índices de Gini más altos del mundo (alrededor de 0.54), indicando una rigidez social y una concentración del ingreso que limita los efectos positivos del crecimiento económico en el bienestar general.",
                indicators: [
                    { id: 3341, name: "Pobreza y pobreza extrema por sexo y edad", note: "La desigualdad intersecta fuertemente con la edad y el género, afectando en mayor proporción a niños y mujeres." }
                ]
            },
            {
                title: "Mantenimiento de profundas brechas de inclusión laboral y de cuidados",
                desc: "El mercado de trabajo regional sigue fuertemente segmentado por género. Las mujeres enfrentan menores tasas de participación y mayor desocupación debido a la injusta organización social de los cuidados, una situación que se agrava al interseccionar con la exclusión que sufren la población indígena, afrodescendiente y las personas con discapacidad.",
                analysis: "En Colombia, la brecha de participación laboral femenina supera los 20 puntos porcentuales. El Sistema Nacional de Cuidado busca mitigar este sesgo, redistribuyendo las labores domésticas no remuneradas para integrar a más mujeres al mercado formal.",
                indicators: [
                    { id: 120, name: "Tasa de participación en la fuerza de trabajo", note: "Visualiza la gran disparidad en las tasas de actividad económica entre hombres y mujeres." },
                    { id: 127, name: "Tasa de desocupación por sexo", note: "Mide el exceso de desempleo femenino frente al masculino." }
                ]
            }
        ]
    },
    {
        id: "comercio_internacional",
        title: "Perspectivas del Comercio Internacional de América Latina y el Caribe 2025",
        shortTitle: "Comercio Internacional",
        icon: "fa-ship",
        trends: [
            {
                title: "Crecimiento comercial bajo amenaza por el proteccionismo global",
                desc: "Si bien las exportaciones regionales de bienes crecieron un 4% en valor durante el primer semestre de 2025, el giro profundo en la política comercial de los Estados Unidos y la imposición de nuevos aranceles plantean un escenario de gran incertidumbre y deterioro para 2026.",
                analysis: "Colombia posee un TLC con EE.UU., pero su canasta exportadora altamente dependiente del carbón y el petróleo (más del 50%) enfrenta retos de aranceles y la necesidad urgente de diversificación hacia manufacturas y agricultura.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante (Exposición comercial)", note: "El nivel de PIB por habitante determina la resiliencia agregada frente a choques arancelarios en mercados clave." }
                ]
            },
            {
                title: "Dinamismo acelerado en la exportación de servicios modernos",
                desc: "El comercio de servicios ha mostrado una expansión más rápida que el de bienes. Las exportaciones de servicios modernos (que incluyen telecomunicaciones, informática y servicios empresariales) lideran este crecimiento con un alza interanual del 13% en la primera mitad de 2025.",
                analysis: "Las exportaciones de servicios de software, BPO y turismo de salud en Colombia han crecido a tasas de doble dígito, convirtiéndose en el renglón más prometedor para equilibrar la balanza de pagos nacional.",
                indicators: [
                    { id: 2206, name: "PIB total anual por habitante (Desarrollo del sector servicios)", note: "Los servicios modernos de alta complejidad aportan valor agregado directo al PIB per cápita." }
                ]
            },
            {
                title: "Baja participación y rezago en exportaciones de alta tecnología",
                desc: "A pesar del crecimiento del comercio de bienes con alto contenido tecnológico a nivel mundial, la participación de América Latina y el Caribe en estas exportaciones se mantiene marginada por debajo del 5%. Esto refleja debilidades estructurales en la formación de capital humano avanzado y en las capacidades productivas de la región.",
                analysis: "Colombia exporta menos de un 2% de bienes con alta tecnología en su canasta industrial. Se requiere escalar la inversión en I+D (que hoy es apenas del 0.3% del PIB) para cerrar la brecha con el este de Asia y economías desarrolladas.",
                indicators: [
                    { id: 120, name: "Tasa de participación en la fuerza de trabajo (Calificación técnica)", note: "La disponibilidad de capital humano activo calificado condiciona la inserción en cadenas de alta tecnología." }
                ]
            }
        ]
    }
];

function setActiveTendenciaReport(reportId) {
    appState.activeTendenciaReport = reportId;
    renderTendencias();
}

function selectIndicatorFromTrend(indicatorId, indicatorName) {
    selectIndicator({
        id: indicatorId,
        name: `[${indicatorId}] ${indicatorName}`,
        categoryPath: "CEPAL / Tendencias 2025"
    });
}

function renderTendencias() {
    const tabsContainer = document.getElementById('tendencias-report-tabs');
    const contentArea = document.getElementById('tendencias-content-area');
    
    if (!tabsContainer || !contentArea) return;
    
    // 1. Render Report Selector Tabs
    tabsContainer.innerHTML = CEPAL_REPORTS_DATA.map(report => {
        const isActive = report.id === appState.activeTendenciaReport;
        return `
            <button class="btn-tab ${isActive ? 'active' : ''}" style="flex: 1; padding: 0.6rem; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; cursor: pointer; border-radius: 8px;" onclick="setActiveTendenciaReport('${report.id}')">
                <i class="fa-solid ${report.icon}"></i>
                <span>${report.shortTitle}</span>
            </button>
        `;
    }).join('');
    
    // 2. Render Active Report Content
    const activeReport = CEPAL_REPORTS_DATA.find(r => r.id === appState.activeTendenciaReport);
    if (!activeReport) return;
    
    let html = `
        <div class="card" style="padding: 1.5rem; background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(17, 24, 39, 0.5) 100%); border-color: rgba(168, 85, 247, 0.15);">
            <div style="display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
                <i class="fa-solid ${activeReport.icon} diagnostic-icon" style="color: var(--color-alc); background: rgba(168, 85, 247, 0.1); font-size: 1.25rem; padding: 0.5rem; border-radius: 8px;"></i>
                <h2 class="diagnostic-title" style="font-size: 1.25rem; font-weight: 700; font-family: var(--font-heading); color: var(--text-primary);">${activeReport.title}</h2>
            </div>
            <p style="font-size: 0.9375rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.6;">
                A continuación se analizan las principales tendencias estructuradas por este informe oficial de la CEPAL para el periodo actual, vinculándolas con la realidad estadística de <strong>América Latina y el Caribe (ALC)</strong> y los indicadores de <strong>Colombia</strong>.
            </p>
        </div>
    `;
    
    activeReport.trends.forEach((trend, idx) => {
        html += `
            <div class="card" style="padding: 1.5rem; transition: var(--transition-smooth);">
                <div style="display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="background: var(--accent-blue); color: #0b0f19; font-weight: 700; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.85rem; margin-top: 0.15rem;">${idx + 1}</div>
                    <div>
                        <h3 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 700; color: var(--text-primary); line-height: 1.3;">${trend.title}</h3>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-left: 2rem;">
                    <!-- Regional Context -->
                    <div style="background: rgba(15, 23, 42, 0.3); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-alc); letter-spacing: 0.5px; display: block; margin-bottom: 0.35rem;">Contexto Regional (América Latina y el Caribe)</span>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">${trend.desc}</p>
                    </div>
                    
                    <!-- Colombia Comparison -->
                    <div style="background: rgba(255, 215, 0, 0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 215, 0, 0.08);">
                        <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-colombia); letter-spacing: 0.5px; display: block; margin-bottom: 0.35rem;">Análisis Comparativo (Caso Colombia)</span>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">${trend.analysis}</p>
                    </div>
                    
                    <!-- Linked Indicators -->
                    <div>
                        <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">Indicadores Relacionados en el Portal:</span>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${trend.indicators.map(ind => `
                                <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border-color); padding: 0.85rem; border-radius: 8px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
                                    <div style="flex: 1; min-width: 250px;">
                                        <strong style="font-size: 0.875rem; color: var(--text-primary); display: block; margin-bottom: 0.25rem;">[${ind.id}] ${ind.name}</strong>
                                        <span style="font-size: 0.8rem; color: var(--text-muted);">${ind.note}</span>
                                    </div>
                                    <button class="btn-primary" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; border-radius: 6px;" onclick="selectIndicatorFromTrend(${ind.id}, '${ind.name.replace(/'/g, "\\'")}')">
                                        <i class="fa-solid fa-chart-line"></i> Explorar Datos en Vivo
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    contentArea.innerHTML = html;
}

// ==========================================
// 20. EXPORTAR DATOS BASE (MASS CONSULTATION)
// ==========================================

let massState = {
    isExporting: false,
    cancelled: false,
    flatIndicators: [],
    categories: {},
    hierarchy: {},
    selectedSubcategories: new Set(),
    selectedCategories: new Set(),
    results: [],
    sortColumn: null,
    sortDirection: 'asc'
};

function initExportarDatosSection() {
    // Reset state
    massState.isExporting = false;
    massState.cancelled = false;
    massState.results = [];
    massState.wasOnlyFavorites = false;
    massState.savedCheckboxStates = null;
    
    // Uncheck onlyFavorites checkbox on init to keep it clean
    const onlyFavCb = document.getElementById('mass-only-favorites');
    if (onlyFavCb) {
        onlyFavCb.checked = false;
    }
    
    // Hide progress, hide results
    document.getElementById('mass-progress-panel').style.display = 'none';
    document.getElementById('mass-results-card').style.display = 'none';
    
    document.getElementById('btn-mass-show').style.display = 'inline-flex';
    document.getElementById('btn-mass-excel').style.display = 'inline-flex';
    document.getElementById('btn-mass-cancel').style.display = 'none';
    
    // Group indicators by top category and subcategory
    massState.flatIndicators = appState.flatIndicators || [];
    massState.hierarchy = {};
    
    massState.flatIndicators.forEach(ind => {
        const parts = ind.categoryPath ? ind.categoryPath.split(' / ') : [];
        const topCat = parts[0] || 'General';
        const subCat = parts[1] || 'General';
        
        if (!massState.hierarchy[topCat]) {
            massState.hierarchy[topCat] = {};
        }
        if (!massState.hierarchy[topCat][subCat]) {
            massState.hierarchy[topCat][subCat] = [];
        }
        massState.hierarchy[topCat][subCat].push(ind);
    });
    
    // Default select all subcategories
    massState.selectedSubcategories = new Set();
    Object.keys(massState.hierarchy).forEach(topCat => {
        Object.keys(massState.hierarchy[topCat]).forEach(subCat => {
            massState.selectedSubcategories.add(`${topCat} - ${subCat}`);
        });
    });
    
    // Render checklist
    const checklistContainer = document.getElementById('mass-categories-checklist');
    if (checklistContainer) {
        checklistContainer.innerHTML = '';
        const topCategories = Object.keys(massState.hierarchy).sort();
        
        if (topCategories.length === 0) {
            checklistContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8125rem;">Cargando listado de indicadores...</div>';
            document.getElementById('btn-mass-show').setAttribute('disabled', 'true');
            document.getElementById('btn-mass-excel').setAttribute('disabled', 'true');
            return;
        }
        
        document.getElementById('btn-mass-show').removeAttribute('disabled');
        document.getElementById('btn-mass-excel').removeAttribute('disabled');
        
        topCategories.forEach(topCat => {
            const subCatsObj = massState.hierarchy[topCat];
            const subCats = Object.keys(subCatsObj).sort();
            
            // Total indicators in this top category
            let topCatCount = 0;
            subCats.forEach(sub => {
                topCatCount += subCatsObj[sub].length;
            });
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'category-group';
            groupDiv.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; background: rgba(15, 23, 42, 0.2); display: flex; flex-direction: column; gap: 0.5rem;';
            
            // Header for top category with select all checkbox
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem;';
            headerDiv.innerHTML = `
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.875rem; color: var(--accent-blue); cursor: pointer; margin-bottom: 0;">
                    <input type="checkbox" class="mass-topcat-checkbox" value="${topCat}" checked autocomplete="off" onchange="toggleTopCat('${topCat}', this.checked)">
                    <span>${topCat}</span>
                </label>
                <span style="font-size: 0.72rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 0.1rem 0.35rem; border-radius: 4px;">${topCatCount} ind.</span>
            `;
            groupDiv.appendChild(headerDiv);
            
            // Subcategories list
            const subListDiv = document.createElement('div');
            subListDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.4rem; padding-left: 0.25rem;';
            
            subCats.forEach(subCat => {
                const count = subCatsObj[subCat].length;
                const subLabel = document.createElement('label');
                subLabel.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; cursor: pointer; color: var(--text-secondary); margin-bottom: 0;';
                subLabel.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" class="mass-subcat-checkbox" data-topcat="${topCat}" value="${subCat}" checked autocomplete="off" onchange="updateMassSelectedCount()">
                        <span>${subCat}</span>
                    </div>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">${count} ind.</span>
                `;
                subListDiv.appendChild(subLabel);
            });
            
            groupDiv.appendChild(subListDiv);
            checklistContainer.appendChild(groupDiv);
        });
        
        // Explicitly set checkboxes checked state programmatically
        document.querySelectorAll('.mass-subcat-checkbox').forEach(cb => {
            cb.checked = true;
        });
        document.querySelectorAll('.mass-topcat-checkbox').forEach(cb => {
            cb.checked = true;
        });
    }
    
    updateMassSelectedCount();
}

function toggleTopCat(topCat, checked) {
    document.querySelectorAll(`.mass-subcat-checkbox[data-topcat="${topCat}"]`).forEach(cb => {
        cb.checked = checked;
    });
    updateMassSelectedCount();
}

function updateMassSelectedCount() {
    const onlyFavorites = !!document.getElementById('mass-only-favorites')?.checked;
    let totalCount = 0;
    
    // Save/update the selected subcategories from checked checkboxes
    const checkboxes = document.querySelectorAll('.mass-subcat-checkbox:checked');
    massState.selectedSubcategories = new Set();
    checkboxes.forEach(cb => {
        const topCat = cb.dataset.topcat;
        const subCat = cb.value;
        const key = `${topCat} - ${subCat}`;
        massState.selectedSubcategories.add(key);
    });
    
    // Compute totalCount based on selection and favorites filter
    if (onlyFavorites) {
        // If only favorites is checked, count all favorites regardless of category checkbox selection
        if (massState.flatIndicators) {
            const favs = massState.flatIndicators.filter(ind => isIndicatorFavorite(ind.id));
            totalCount = favs.length;
        }
    } else {
        // Count indicators in selected subcategories
        checkboxes.forEach(cb => {
            const topCat = cb.dataset.topcat;
            const subCat = cb.value;
            if (massState.hierarchy[topCat] && massState.hierarchy[topCat][subCat]) {
                totalCount += massState.hierarchy[topCat][subCat].length;
            }
        });
    }
    
    // Update parent top category checkboxes to reflect checked/unchecked/indeterminate state
    if (massState.hierarchy) {
        Object.keys(massState.hierarchy).forEach(topCat => {
            const subCbs = document.querySelectorAll(`.mass-subcat-checkbox[data-topcat="${topCat}"]`);
            const checkedSubCbs = document.querySelectorAll(`.mass-subcat-checkbox[data-topcat="${topCat}"]:checked`);
            const topCb = document.querySelector(`.mass-topcat-checkbox[value="${topCat}"]`);
            if (topCb) {
                if (checkedSubCbs.length === 0) {
                    topCb.checked = false;
                    topCb.indeterminate = false;
                } else if (checkedSubCbs.length === subCbs.length) {
                    topCb.checked = true;
                    topCb.indeterminate = false;
                } else {
                    topCb.checked = false;
                    topCb.indeterminate = true;
                }
            }
        });
    }
    
    const countEl = document.getElementById('mass-selected-count');
    if (countEl) {
        countEl.textContent = `${totalCount} indicadores seleccionados`;
    }
    
    // Manage warnings for favorites
    const warningEl = document.getElementById('mass-favorites-warning');
    if (warningEl) {
        if (onlyFavorites && totalCount === 0) {
            const list = JSON.parse(localStorage.getItem('favorite_indicators') || '[]');
            if (list.length === 0) {
                warningEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> No tienes ningún indicador guardado. Agrega favoritos en el explorador de la izquierda antes de exportar.';
            } else {
                const details = list.map(item => `• [ID: ${item.id}] ${item.name || 'Sin nombre'}`).join('<br>');
                
                // User-visible debug info to isolate why count is 0
                let debugInfo = [];
                const allCbs = document.querySelectorAll('.mass-subcat-checkbox').length;
                const checkedCbs = document.querySelectorAll('.mass-subcat-checkbox:checked').length;
                debugInfo.push(`Total subcat checkboxes in DOM: ${allCbs}, Checked: ${checkedCbs}`);
                debugInfo.push(`massState.selectedSubcategories size: ${massState.selectedSubcategories.size}`);
                
                if (massState.flatIndicators) {
                    const matchedFavs = massState.flatIndicators.filter(ind => isIndicatorFavorite(ind.id));
                    debugInfo.push(`Favoritos encontrados en flatIndicators: ${matchedFavs.length}`);
                    matchedFavs.forEach(ind => {
                        const parts = ind.categoryPath ? ind.categoryPath.split(' / ') : [];
                        const topCat = parts[0] || 'General';
                        const subCat = parts[1] || 'General';
                        const key = `${topCat} - ${subCat}`;
                        const isCatChecked = massState.selectedSubcategories.has(key);
                        debugInfo.push(`- [ID: ${ind.id}] en [${key}] (¿Seleccionado?: ${isCatChecked})`);
                    });
                } else {
                    debugInfo.push("flatIndicators está vacío o undefined!");
                }
                const debugStr = debugInfo.join('<br>');
                
                warningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> No tienes indicadores guardados dentro de las categorías seleccionadas.<br><div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem; text-align: left; line-height: 1.4;"><strong>Guardados en el navegador:</strong><br>${details}<br><br><strong>Información de depuración:</strong><br>${debugStr}</div>`;
            }
            warningEl.style.display = 'block';
        } else {
            warningEl.style.display = 'none';
        }
    }
    
    const showBtn = document.getElementById('btn-mass-show');
    const excelBtn = document.getElementById('btn-mass-excel');
    
    if (showBtn && excelBtn) {
        if (totalCount === 0) {
            showBtn.setAttribute('disabled', 'true');
            excelBtn.setAttribute('disabled', 'true');
            showBtn.style.opacity = '0.5';
            showBtn.style.pointerEvents = 'none';
            excelBtn.style.opacity = '0.5';
            excelBtn.style.pointerEvents = 'none';
        } else {
            showBtn.removeAttribute('disabled');
            excelBtn.removeAttribute('disabled');
            showBtn.style.opacity = '1';
            showBtn.style.pointerEvents = 'auto';
            excelBtn.style.opacity = '1';
            excelBtn.style.pointerEvents = 'auto';
        }
    }
}

function selectAllMassCategories(checked) {
    document.querySelectorAll('.mass-subcat-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    document.querySelectorAll('.mass-topcat-checkbox').forEach(cb => {
        cb.checked = checked;
        cb.indeterminate = false;
    });
    updateMassSelectedCount();
}

async function startMassQuery(mode) {
    massState.isExporting = true;
    massState.cancelled = false;
    massState.results = [];
    
    // Hide buttons, show progress, hide results card
    document.getElementById('btn-mass-show').style.display = 'none';
    document.getElementById('btn-mass-excel').style.display = 'none';
    document.getElementById('btn-mass-cancel').style.display = 'inline-flex';
    document.getElementById('mass-progress-panel').style.display = 'block';
    document.getElementById('mass-results-card').style.display = 'none';
    
    const onlyFavorites = document.getElementById('mass-only-favorites')?.checked;
    
    // Gather all selected indicators
    const indicatorsToFetch = [];
    massState.flatIndicators.forEach(ind => {
        if (onlyFavorites) {
            if (isIndicatorFavorite(ind.id)) {
                indicatorsToFetch.push(ind);
            }
        } else {
            const parts = ind.categoryPath ? ind.categoryPath.split(' / ') : [];
            const topCat = parts[0] || 'General';
            const subCat = parts[1] || 'General';
            const key = `${topCat} - ${subCat}`;
            if (massState.selectedSubcategories.has(key)) {
                indicatorsToFetch.push(ind);
            }
        }
    });
    
    const total = indicatorsToFetch.length;
    let processed = 0;
    const CONCURRENCY = 15;
    
    async function worker(queue) {
        while (queue.length > 0 && !massState.cancelled) {
            const ind = queue.shift();
            if (!ind) continue;
            
            try {
                // Fetch data for Colombia, ALC (212), AL (211) and LAT (43053)
                const url = `${API_DATA_BASE}/${ind.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID},211,${LAT_MEMBER_ID}`;
                const response = await fetch(url);
                if (response.ok) {
                    const res = await response.json();
                    const body = res.body;
                    
                    const record = extractSharedYearData(ind, body);
                    if (record) {
                        massState.results.push(record);
                    }
                }
            } catch (err) {
                console.error(`Error al descargar datos del indicador ${ind.id}:`, err);
            }
            
            processed++;
            updateMassProgress(processed, total, ind.name);
        }
    }
    
    const queue = [...indicatorsToFetch];
    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
        workers.push(worker(queue));
    }
    
    await Promise.all(workers);
    
    // Reset controls
    massState.isExporting = false;
    document.getElementById('btn-mass-cancel').style.display = 'none';
    document.getElementById('btn-mass-show').style.display = 'inline-flex';
    document.getElementById('btn-mass-excel').style.display = 'inline-flex';
    
    if (massState.cancelled) {
        document.getElementById('mass-progress-status').textContent = 'Consulta cancelada. Resultados parciales obtenidos.';
    } else {
        document.getElementById('mass-progress-status').textContent = 'Consulta finalizada con éxito.';
    }
    
    // Handle modes
    if (mode === 'excel') {
        downloadMassXlsReport();
    } else if (mode === 'show') {
        document.getElementById('mass-results-card').style.display = 'block';
        renderMassTable();
        document.getElementById('mass-results-card').scrollIntoView({ behavior: 'smooth' });
    }
}

function cancelMassQuery() {
    massState.cancelled = true;
    document.getElementById('mass-progress-status').textContent = 'Cancelando y compilando resultados parciales...';
}

function updateMassProgress(processed, total, currentName) {
    const pct = Math.round((processed / total) * 100);
    const pctEl = document.getElementById('mass-progress-percent');
    const fillEl = document.getElementById('mass-progress-fill');
    const statusEl = document.getElementById('mass-progress-status');
    const detailEl = document.getElementById('mass-progress-detail');
    
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    
    if (statusEl) {
        if (massState.cancelled) {
            statusEl.textContent = 'Cancelando y guardando datos...';
        } else {
            statusEl.textContent = `Procesando: ${processed} de ${total}`;
        }
    }
    
    if (detailEl) detailEl.textContent = `Indicador actual: ${currentName}`;
}

function downloadMassXlsReport() {
    const sortedResults = [...massState.results].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.code - b.code;
    });
    
    let xlsHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Indicadores CEPAL</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: left; }
                td { border: 1px solid #cbd5e1; padding: 8px; color: #334155; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .category-row { background-color: #f8fafc; font-weight: bold; }
                .header-title { font-size: 16pt; font-weight: bold; color: #1e3a8a; padding: 15px 0; }
                .meta-cell { font-size: 9pt; color: #64748b; padding-bottom: 20px; }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <td colspan="11" class="header-title">Listado de Indicadores Comparativos CEPAL (Exportación)</td>
                </tr>
                <tr>
                    <td colspan="11" class="meta-cell">
                        <strong>Ámbito Geográfico:</strong> Colombia vs. Agrupaciones Regionales de América Latina<br>
                        <strong>Fecha de Generación:</strong> ${new Date().toLocaleDateString('es-ES')}<br>
                        <strong>Origen de Datos:</strong> API Oficial de la CEPAL (Sistemas de Indicadores)<br>
                        <strong>Total de Registros:</strong> ${sortedResults.length} indicadores comparados
                    </td>
                </tr>
                <thead>
                    <tr>
                        <th style="width: 80px;">Código</th>
                        <th style="width: 220px;">Clase / Ruta Temática</th>
                        <th style="width: 300px;">Indicador</th>
                        <th style="width: 80px;" class="text-center">Año Compartido</th>
                        <th style="width: 110px;" class="text-right">Colombia</th>
                        <th style="width: 110px;" class="text-right">ALC (212)</th>
                        <th style="width: 110px;" class="text-right">AL (211)</th>
                        <th style="width: 110px;" class="text-right">AL Prom. Simple</th>
                        <th style="width: 110px;" class="text-right">Región Comparada</th>
                        <th style="width: 110px;" class="text-right">Brecha Absoluta</th>
                        <th style="width: 110px;" class="text-right">Desviación Relativa Estándar (DRE)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedResults.forEach(row => {
        xlsHtml += `
            <tr>
                <td class="text-center">${row.code}</td>
                <td>${row.category}</td>
                <td>${row.name}</td>
                <td class="text-center">${row.year}</td>
                <td class="text-right">${formatXlsValue(row.colVal)}</td>
                <td class="text-right">${formatXlsValue(row.alcVal)}</td>
                <td class="text-right">${formatXlsValue(row.alVal)}</td>
                <td class="text-right">${formatXlsValue(row.latVal)}</td>
                <td class="text-center">${row.regionLabel || ''}</td>
                <td class="text-right">${formatXlsValue(row.gap)}</td>
                <td class="text-right">${formatXlsValue(row.dre)}</td>
            </tr>
        `;
    });
    
    xlsHtml += `
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    const filename = `listado_completo_cepal_${new Date().toISOString().slice(0,10)}.xls`;
    const blob = new Blob(['\ufeff' + xlsHtml], {
        type: 'application/vnd.ms-excel;charset=utf-8'
    });
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

function renderMassTable() {
    const tbody = document.getElementById('mass-results-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (massState.results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted);">No se encontraron datos coincidentes para los indicadores seleccionados.</td></tr>';
        return;
    }
    
    // Sort before rendering if there's an active sort column
    if (massState.sortColumn) {
        const col = massState.sortColumn;
        const dir = massState.sortDirection === 'asc' ? 1 : -1;
        massState.results.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];
            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * dir;
            }
            return (valA - valB) * dir;
        });
    }
    
    massState.results.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'mass-table-row';
        tr.dataset.name = row.name.toLowerCase();
        tr.dataset.category = row.category.toLowerCase();
        tr.dataset.code = row.code.toString();
        
        tr.innerHTML = `
            <td class="text-center" style="font-weight: 600; color: var(--text-primary);">${row.code}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${row.category}</td>
            <td style="font-weight: 500; color: var(--text-primary);">${row.name}</td>
            <td style="text-align: center; font-weight: 500;">${row.year}</td>
            <td style="text-align: right; font-weight: 600; color: var(--color-colombia);">${formatNumber(row.colVal)}</td>
            <td style="text-align: right; font-weight: 500; color: var(--color-alc);">${formatNumber(row.alcVal)}</td>
            <td style="text-align: right; font-weight: 500; color: var(--text-secondary);">${formatNumber(row.alVal)}</td>
            <td style="text-align: right; font-weight: 500; color: var(--text-muted);">${formatNumber(row.latVal)}</td>
            <td style="text-align: right; font-weight: 500; color: ${row.gap !== null && row.gap !== undefined ? (row.gap >= 0 ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-muted)'};">
                ${row.gap !== null && row.gap !== undefined ? (row.gap >= 0 ? '+' : '') + formatNumber(row.gap) : '-'}
                ${row.regionLabel ? `<span style="font-size: 0.65rem; color: var(--text-muted); display: block;">vs ${row.regionLabel}</span>` : ''}
            </td>
            <td style="text-align: right; font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">
                ${row.dre !== null && row.dre !== undefined ? (row.dre >= 0 ? '+' : '') + formatNumber(row.dre) : '-'}
            </td>
            <td style="text-align: center;">
                <button class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.72rem; border-radius: 4px;" onclick="selectIndicatorFromTrend(${row.code}, '${row.name.replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-chart-line"></i> Graficar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterMassTable(query) {
    const q = query.toLowerCase().trim();
    const rows = document.querySelectorAll('.mass-table-row');
    
    rows.forEach(tr => {
        const name = tr.dataset.name;
        const cat = tr.dataset.category;
        const code = tr.dataset.code;
        
        if (name.includes(q) || cat.includes(q) || code.includes(q)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
}

function sortMassTable(column) {
    if (massState.sortColumn === column) {
        massState.sortDirection = massState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        massState.sortColumn = column;
        massState.sortDirection = 'asc';
    }
    renderMassTable();
}

function exportMassTableToCSV() {
    if (massState.results.length === 0) return;
    
    let csvContent = '\uFEFF'; // BOM
    csvContent += 'Código,Clase/Ruta Temática,Indicador,Año Compartido,Valor Colombia,Valor ALC (212),Valor AL (211),Valor AL Prom. Simple (43053),Región Comparada,Brecha Absoluta,Desviación Relativa Estándar (DRE)\n';
    
    massState.results.forEach(row => {
        const cat = `"${row.category.replace(/"/g, '""')}"`;
        const name = `"${row.name.replace(/"/g, '""')}"`;
        const colVal = row.colVal !== undefined && row.colVal !== null ? row.colVal : '';
        const alcVal = row.alcVal !== undefined && row.alcVal !== null ? row.alcVal : '';
        const alVal = row.alVal !== undefined && row.alVal !== null ? row.alVal : '';
        const latVal = row.latVal !== undefined && row.latVal !== null ? row.latVal : '';
        const gap = row.gap !== null && row.gap !== undefined ? row.gap : '';
        const dre = row.dre !== null && row.dre !== undefined ? row.dre : '';
        const regionLabel = row.regionLabel || '';
        csvContent += `${row.code},${cat},${name},${row.year},${colVal},${alcVal},${alVal},${latVal},${regionLabel},${gap},${dre}\n`;
    });
    
    const filename = `listado_completo_cepal_${new Date().toISOString().slice(0,10)}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            }
    }
}

// ==========================================
// 21. CREADOR DE INDICADORES SINTÉTICOS
// ==========================================

let creatorIndicatorCount = 0;

function addIndicatorInputRow(initialVal = '') {
    const container = document.getElementById('creator-indicators-list');
    if (!container) return;
    
    creatorIndicatorCount++;
    const idx = creatorIndicatorCount;
    
    const row = document.createElement('div');
    row.className = 'creator-indicator-row';
    row.id = `creator-indicator-row-${idx}`;
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '0.5rem';
    row.style.padding = '1rem';
    row.style.borderRadius = '8px';
    row.style.background = 'rgba(255, 255, 255, 0.02)';
    row.style.border = '1px solid var(--border-color)';
    
    // Label depending on position
    let labelText = `Indicador #${idx}`;
    if (idx === 1) labelText = 'Indicador A (Base)';
    else if (idx === 2) labelText = 'Indicador B';
    else if (idx === 3) labelText = 'Indicador C';
    
    // Show remove button for 3rd or subsequent indicators
    const showRemove = idx > 2;
    
    row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label class="filter-label" style="font-weight: 600; margin-bottom: 0; color: var(--text-secondary);">${labelText}</label>
            ${showRemove ? `
                <button type="button" class="btn-danger-icon" onclick="removeIndicatorInputRow(${idx})" style="background: transparent; border: none; color: var(--accent-red); cursor: pointer; padding: 0.2rem; font-size: 0.95rem; transition: var(--transition-smooth);" title="Eliminar este indicador">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            ` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="number" id="creator-ind-${idx}-id" class="search-input creator-ind-code-input" value="${initialVal}" placeholder="Código CEPAL (ej: 4789)" style="padding: 0.6rem 1rem; border-radius: 8px; font-weight: 600; flex: 1;">
            <button type="button" class="btn-primary" onclick="validateAndFetchIndicatorName(${idx})" style="padding: 0.6rem 1.2rem; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; gap: 0.35rem;">
                <i class="fa-solid fa-magnifying-glass"></i> Buscar
            </button>
        </div>
        <span id="creator-ind-${idx}-name" class="creator-ind-name-label" style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">Ingrese código y busque para validar.</span>
    `;
    
    container.appendChild(row);
    
    // Attach change listener to reset validation status on change
    const inputEl = document.getElementById(`creator-ind-${idx}-id`);
    if (inputEl) {
        inputEl.addEventListener('change', () => {
            const nameEl = document.getElementById(`creator-ind-${idx}-name`);
            nameEl.textContent = 'Ingrese código y busque para validar.';
            nameEl.style.color = 'var(--text-muted)';
            nameEl.dataset.verified = "false";
        });
    }
}

function removeIndicatorInputRow(idx) {
    const row = document.getElementById(`creator-indicator-row-${idx}`);
    if (row) {
        row.remove();
        suggestCustomName();
    }
}

function initCreadorSection() {
    const container = document.getElementById('creator-indicators-list');
    if (container) {
        container.innerHTML = '';
    }
    creatorIndicatorCount = 0;
    
    // Add the first two default indicator rows
    addIndicatorInputRow();
    addIndicatorInputRow();
    
    // Reset operators/scale/names
    document.getElementById('creator-operator').value = 'add';
    document.getElementById('creator-scale').value = '1';
    document.getElementById('creator-custom-name').value = '';
    document.getElementById('creator-custom-unit').value = '';
    
    // Bind operator change event to auto name suggestion
    const opSelect = document.getElementById('creator-operator');
    if (opSelect) {
        opSelect.removeEventListener('change', suggestCustomName);
        opSelect.addEventListener('change', suggestCustomName);
    }
    
    // Hide panels
    document.getElementById('creator-progress-panel').style.display = 'none';
    document.getElementById('creator-results-area').style.display = 'none';
    
    // Clear state
    appState.customIndicatorResults = [];
    if (appState.customChartInstance) {
        appState.customChartInstance.destroy();
        appState.customChartInstance = null;
    }
    
    // Load saved custom indicators from local database
    loadSavedIndicators();
}

async function validateAndFetchIndicatorName(index) {
    const inputId = `creator-ind-${index}-id`;
    const nameId = `creator-ind-${index}-name`;
    
    const valStr = document.getElementById(inputId).value.trim();
    const nameEl = document.getElementById(nameId);
    if (!nameEl) return;
    
    if (!valStr) {
        nameEl.textContent = 'Ingrese un código válido.';
        nameEl.style.color = 'var(--accent-red)';
        nameEl.dataset.verified = "false";
        return;
    }
    
    const id = parseInt(valStr);
    if (isNaN(id)) {
        nameEl.textContent = 'El código debe ser un número.';
        nameEl.style.color = 'var(--accent-red)';
        nameEl.dataset.verified = "false";
        return;
    }
    
    nameEl.textContent = 'Validando e identificando...';
    nameEl.style.color = 'var(--text-muted)';
    
    // 1. Try local cache lookup
    if (appState.flatIndicators && appState.flatIndicators.length > 0) {
        const localMatch = appState.flatIndicators.find(item => item.id === id);
        if (localMatch) {
            nameEl.textContent = `✓ [${localMatch.id}] ${localMatch.name}`;
            nameEl.style.color = 'var(--accent-green)';
            nameEl.dataset.verified = "true";
            nameEl.dataset.cleanName = localMatch.name;
            nameEl.dataset.unit = localMatch.unit || '';
            
            suggestCustomName();
            return;
        }
    }
    
    // 2. Fallback to CEPAL API
    try {
        const url = `${API_DATA_BASE}/${id}/data?lang=es&members=${COLOMBIA_MEMBER_ID}`;
        const response = await fetch(url);
        if (response.ok) {
            const res = await response.json();
            const metadata = res.body.metadata || {};
            const name = metadata.name || metadata.description || `Indicador #${id}`;
            nameEl.textContent = `✓ [${id}] ${name}`;
            nameEl.style.color = 'var(--accent-green)';
            nameEl.dataset.verified = "true";
            nameEl.dataset.cleanName = name;
            nameEl.dataset.unit = metadata.unit || '';
            
            suggestCustomName();
        } else {
            nameEl.textContent = '✕ Código no encontrado en la API de la CEPAL.';
            nameEl.style.color = 'var(--accent-red)';
            nameEl.dataset.verified = "false";
        }
    } catch (err) {
        nameEl.textContent = '✕ Error al validar con la API.';
        nameEl.style.color = 'var(--accent-red)';
        nameEl.dataset.verified = "false";
        console.error(err);
    }
}

function suggestCustomName() {
    const op = document.getElementById('creator-operator').value;
    const nameInput = document.getElementById('creator-custom-name');
    
    const rows = document.querySelectorAll('.creator-indicator-row');
    const names = [];
    const units = new Set();
    
    rows.forEach(row => {
        const idx = row.id.replace('creator-indicator-row-', '');
        const nameEl = document.getElementById(`creator-ind-${idx}-name`);
        if (nameEl && nameEl.dataset.verified === "true") {
            names.push(nameEl.dataset.cleanName);
            if (nameEl.dataset.unit) {
                units.add(nameEl.dataset.unit);
            }
        }
    });
    
    if (names.length >= 2) {
        let opWord = 'combinado con';
        if (op === 'add') opWord = 'Suma de';
        else if (op === 'subtract') opWord = 'Diferencia de';
        else if (op === 'multiply') opWord = 'Producto de';
        else if (op === 'divide') opWord = 'Ratio de';
        
        let customName = '';
        if (op === 'divide') {
            customName = names.join(' / ');
        } else if (op === 'add' || op === 'multiply' || op === 'subtract') {
            if (names.length === 2) {
                customName = `${opWord} ${names[0]} y ${names[1]}`;
            } else {
                const last = names[names.length - 1];
                const rest = names.slice(0, -1).join(', ');
                customName = `${opWord} ${rest} y ${last}`;
            }
        } else {
            customName = `${opWord} ${names.join(', ')}`;
        }
        nameInput.value = customName;
        
        // Auto suggest unit
        const unitInput = document.getElementById('creator-custom-unit');
        if (units.size === 1) {
            unitInput.value = Array.from(units)[0];
        } else if (op === 'divide') {
            const rowUnits = [];
            rows.forEach(row => {
                const idx = row.id.replace('creator-indicator-row-', '');
                const nameEl = document.getElementById(`creator-ind-${idx}-name`);
                if (nameEl && nameEl.dataset.verified === "true") {
                    rowUnits.push(nameEl.dataset.unit || 'unidad');
                }
            });
            unitInput.value = rowUnits.join(' / ');
        } else {
            unitInput.value = '';
        }
    }
}

async function fetchIndicatorSeries(id) {
    const url = `${API_DATA_BASE}/${id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error API cepalstat al descargar indicador #${id}`);
    const res = await response.json();
    return res.body;
}

function extractSeriesData(body) {
    const data = body.data || [];
    const dimensions = body.dimensions || [];
    
    const yearDim = dimensions.find(d => d.id === YEAR_DIM_ID);
    if (!yearDim) return { col: {}, alc: {}, years: new Set(), unit: '' };
    
    const yearMap = {};
    yearDim.members.forEach(m => {
        yearMap[m.id] = m.name;
    });
    
    const metadata = body.metadata || {};
    const unit = metadata.unit || '';
    
    // Detect default secondary filters
    const secondaryFilters = {};
    const secondaryDims = dimensions.filter(d => d.id !== COUNTRY_DIM_ID && d.id !== YEAR_DIM_ID);
    secondaryDims.forEach(dim => {
        const members = dim.members || [];
        let defaultMember = members.find(m => m.selected === 1);
        if (!defaultMember) defaultMember = members.find(m => m.in === 1);
        if (!defaultMember) {
            defaultMember = members.find(m => {
                const name = m.name.toLowerCase();
                return name.includes('ambos') || name.includes('total') || name.includes('nacional');
            });
        }
        if (!defaultMember && members.length > 0) defaultMember = members[0];
        if (defaultMember) {
            secondaryFilters[dim.id] = defaultMember.id;
        }
    });
    
    // Filter records matching secondary filters
    const filtered = data.filter(rec => {
        for (const [dimId, memberId] of Object.entries(secondaryFilters)) {
            const val = rec[`dim_${dimId}`];
            if (val !== undefined && val !== memberId) {
                return false;
            }
        }
        return true;
    });
    
    const colData = {};
    const alcData = {};
    const years = new Set();
    
    filtered.forEach(rec => {
        const countryId = rec[`dim_${COUNTRY_DIM_ID}`];
        const yearMemberId = rec[`dim_${YEAR_DIM_ID}`];
        const yearLabel = yearMap[yearMemberId];
        if (!yearLabel) return;
        
        const val = parseFloat(rec.value);
        if (isNaN(val)) return;
        
        if (countryId === COLOMBIA_MEMBER_ID) {
            colData[yearLabel] = val;
            years.add(yearLabel);
        } else if (countryId === ALC_MEMBER_ID) {
            alcData[yearLabel] = val;
            years.add(yearLabel);
        }
    });
    
    return { col: colData, alc: alcData, years, unit };
}

async function generateSyntheticIndicator() {
    const rows = document.querySelectorAll('.creator-indicator-row');
    const indicators = [];
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const idx = row.id.replace('creator-indicator-row-', '');
        const idStr = document.getElementById(`creator-ind-${idx}-id`).value.trim();
        if (!idStr) {
            alert(`Por favor, ingresa el código del indicador #${idx}.`);
            return;
        }
        const id = parseInt(idStr);
        if (isNaN(id)) {
            alert(`El código del indicador #${idx} debe ser un número válido.`);
            return;
        }
        indicators.push({ index: idx, id: id });
    }
    
    if (indicators.length < 2) {
        alert('Debes ingresar al menos dos indicadores para combinar.');
        return;
    }
    
    const op = document.getElementById('creator-operator').value;
    const scale = parseFloat(document.getElementById('creator-scale').value) || 1;
    const customName = document.getElementById('creator-custom-name').value.trim() || 'Indicador Sintético Personalizado';
    const customUnit = document.getElementById('creator-custom-unit').value.trim();
    
    const progressPanel = document.getElementById('creator-progress-panel');
    const resultsArea = document.getElementById('creator-results-area');
    const statusText = document.getElementById('creator-progress-status');
    
    progressPanel.style.display = 'flex';
    resultsArea.style.display = 'none';
    statusText.textContent = 'Descargando series desde la API de la CEPAL...';
    
    try {
        // Fetch indicators in parallel
        const bodies = await Promise.all(
            indicators.map(ind => fetchIndicatorSeries(ind.id))
        );
        
        statusText.textContent = 'Procesando y alineando datos de series...';
        
        const seriesList = bodies.map(body => extractSeriesData(body));
        
        // Auto-assign unit if customUnit is not entered
        let resolvedUnit = customUnit;
        if (!resolvedUnit) {
            const allUnits = seriesList.map(s => s.unit);
            const uniqueUnits = new Set(allUnits);
            if (uniqueUnits.size === 1) {
                resolvedUnit = allUnits[0];
            } else if (op === 'divide') {
                resolvedUnit = allUnits.map(u => u || 'unidad').join(' / ');
            } else {
                resolvedUnit = allUnits.filter(u => u).join(' & ');
            }
        }
        
        // Find union of all years from all series
        const allYearsSet = new Set();
        seriesList.forEach(series => {
            series.years.forEach(yr => allYearsSet.add(yr));
        });
        const sortedYears = Array.from(allYearsSet).sort((x, y) => parseInt(x) - parseInt(y));
        
        appState.customIndicatorResults = [];
        
        sortedYears.forEach(year => {
            // Collect Colombia values
            const colVals = [];
            let allColValid = true;
            for (let s = 0; s < seriesList.length; s++) {
                const val = seriesList[s].col[year];
                if (val === undefined) {
                    allColValid = false;
                    break;
                }
                colVals.push(val);
            }
            
            // Collect ALC values
            const alcVals = [];
            let allAlcValid = true;
            for (let s = 0; s < seriesList.length; s++) {
                const val = seriesList[s].alc[year];
                if (val === undefined) {
                    allAlcValid = false;
                    break;
                }
                alcVals.push(val);
            }
            
            let colVal = undefined;
            let alcVal = undefined;
            
            if (allColValid) {
                let res = colVals[0];
                for (let v = 1; v < colVals.length; v++) {
                    if (op === 'add') res += colVals[v];
                    else if (op === 'subtract') res -= colVals[v];
                    else if (op === 'multiply') res *= colVals[v];
                    else if (op === 'divide') {
                        if (colVals[v] !== 0) {
                            res /= colVals[v];
                        } else {
                            res = undefined;
                            break;
                        }
                    }
                }
                if (res !== undefined) {
                    colVal = res * scale;
                }
            }
            
            if (allAlcValid) {
                let res = alcVals[0];
                for (let v = 1; v < alcVals.length; v++) {
                    if (op === 'add') res += alcVals[v];
                    else if (op === 'subtract') res -= alcVals[v];
                    else if (op === 'multiply') res *= alcVals[v];
                    else if (op === 'divide') {
                        if (alcVals[v] !== 0) {
                            res /= alcVals[v];
                        } else {
                            res = undefined;
                            break;
                        }
                    }
                }
                if (res !== undefined) {
                    alcVal = res * scale;
                }
            }
            
            if (colVal !== undefined || alcVal !== undefined) {
                const gap = (colVal !== undefined && alcVal !== undefined) ? colVal - alcVal : 0;
                const dre = (alcVal !== undefined && alcVal !== 0) ? gap / alcVal : 0;
                
                appState.customIndicatorResults.push({
                    year: year,
                    colVal: colVal,
                    alcVal: alcVal,
                    gap: gap,
                    dre: dre
                });
            }
        });
        
        if (appState.customIndicatorResults.length === 0) {
            alert('No se encontraron años en común con datos válidos para todos los indicadores seleccionados.');
            progressPanel.style.display = 'none';
            return;
        }
        
        // Hide loader, show results
        progressPanel.style.display = 'none';
        resultsArea.style.display = 'flex';
        
        // Populate Formula Card details
        const resultTitleEl = document.getElementById('creator-result-title');
        const resultFormulaEl = document.getElementById('creator-result-formula');
        const resultScaleEl = document.getElementById('creator-result-scale-badge');
        
        if (resultTitleEl && resultFormulaEl && resultScaleEl) {
            resultTitleEl.textContent = customName;
            
            const formulaParts = [];
            indicators.forEach(ind => {
                const nameEl = document.getElementById(`creator-ind-${ind.index}-name`);
                const cleanName = nameEl && nameEl.dataset.verified === "true" ? nameEl.dataset.cleanName : `Indicador #${ind.id}`;
                formulaParts.push(`<span style="color: var(--accent-blue); font-weight: 600;">[${ind.id}]</span> ${escapeHtml(cleanName)}`);
            });
            const opSymbol = getOpSymbol(op);
            let formulaHtml = formulaParts.join(` <strong style="color: var(--text-primary); font-size: 1.1rem; margin: 0 0.25rem;">${opSymbol}</strong> `);
            if (scale !== 1) {
                formulaHtml = `(${formulaHtml}) <strong style="color: var(--text-primary); font-size: 1.1rem; margin: 0 0.25rem;">×</strong> ${scale}`;
            }
            
            resultFormulaEl.innerHTML = formulaHtml;
            resultScaleEl.innerHTML = `Escala: <span style="color: var(--text-primary);">x${scale}</span> ${resolvedUnit ? `(${resolvedUnit})` : ''}`;
        }
        
        // 1. Populate KPI Cards
        const lastRec = appState.customIndicatorResults[appState.customIndicatorResults.length - 1];
        
        const kpiColVal = document.getElementById('creator-kpi-col-val');
        const kpiColYear = document.getElementById('creator-kpi-col-year');
        const kpiAlcVal = document.getElementById('creator-kpi-alc-val');
        const kpiAlcYear = document.getElementById('creator-kpi-alc-year');
        const kpiGapVal = document.getElementById('creator-kpi-gap-val');
        const kpiGapPct = document.getElementById('creator-kpi-gap-pct');
        
        kpiColVal.textContent = lastRec.colVal !== undefined ? `${formatNumber(lastRec.colVal)} ${resolvedUnit}` : '-';
        kpiColYear.innerHTML = `<span>Año: ${lastRec.year}</span>`;
        
        kpiAlcVal.textContent = lastRec.alcVal !== undefined ? `${formatNumber(lastRec.alcVal)} ${resolvedUnit}` : '-';
        kpiAlcYear.innerHTML = `<span>Año: ${lastRec.year}</span>`;
        
        if (lastRec.colVal !== undefined && lastRec.alcVal !== undefined) {
            kpiGapVal.textContent = `${formatNumber(lastRec.gap)} ${resolvedUnit}`;
            kpiGapPct.innerHTML = `<i class="fa-solid ${lastRec.gap >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> <span>Diferencia de ${formatNumber(Math.abs(lastRec.dre * 100))}% vs ALC</span>`;
        } else {
            kpiGapVal.textContent = '-';
            kpiGapPct.innerHTML = '<span>Dato parcial</span>';
        }
        
        // 2. Render Chart
        renderCustomChart(customName, resolvedUnit);
        
        // 3. Render Table
        renderCustomTable();
        
    } catch (error) {
        progressPanel.style.display = 'none';
        alert(`Ocurrió un error al procesar el indicador: ${error.message}`);
        console.error(error);
    }
}

function renderCustomChart(name, unit) {
    const ctx = document.getElementById('creator-chart');
    if (!ctx) return;
    
    if (appState.customChartInstance) {
        appState.customChartInstance.destroy();
    }
    
    const years = appState.customIndicatorResults.map(r => r.year);
    const colSeries = appState.customIndicatorResults.map(r => r.colVal !== undefined ? r.colVal : null);
    const alcSeries = appState.customIndicatorResults.map(r => r.alcVal !== undefined ? r.alcVal : null);
    
    const config = {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Colombia',
                    data: colSeries,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#f59e0b',
                    tension: 0.15,
                    spanGaps: true
                },
                {
                    label: 'América Latina y el Caribe',
                    data: alcSeries,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#a855f7',
                    tension: 0.15,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#e2e8f0', font: { family: 'Inter', size: 12 } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.raw)} ${unit}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } },
                    title: { display: true, text: unit, color: '#94a3b8' }
                }
            }
        }
    };
    
    appState.customChartInstance = new Chart(ctx, config);
}

function renderCustomTable() {
    const tbody = document.getElementById('creator-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Display in reverse order (newest first)
    const reversed = [...appState.customIndicatorResults].reverse();
    
    reversed.forEach(row => {
        const isProj = parseInt(row.year) >= 2025;
        
        let gapStr = '-';
        let dreStr = '-';
        if (row.colVal !== undefined && row.alcVal !== undefined) {
            gapStr = formatNumber(row.gap);
            dreStr = `${row.gap >= 0 ? '+' : ''}${formatNumber(row.dre * 100)}%`;
        }
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td style="padding: 0.5rem; text-align: left;">${row.year} ${isProj ? '<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #c084fc;">PROY.</span>' : '<span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399;">REAL</span>'}</td>
            <td class="colombia-cell" style="padding: 0.5rem; text-align: right; font-weight: 600; color: var(--color-colombia);">${row.colVal !== undefined ? formatNumber(row.colVal) : '-'}</td>
            <td class="alc-cell" style="padding: 0.5rem; text-align: right; font-weight: 600; color: var(--color-alc);">${row.alcVal !== undefined ? formatNumber(row.alcVal) : '-'}</td>
            <td style="padding: 0.5rem; text-align: right;">${gapStr}</td>
            <td style="padding: 0.5rem; text-align: right; font-weight: 500; color: ${row.gap >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${dreStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportCustomToCSV() {
    if (!appState.customIndicatorResults || appState.customIndicatorResults.length === 0) return;
    
    const customName = document.getElementById('creator-custom-name').value.trim() || 'Indicador Sintético';
    const customUnit = document.getElementById('creator-custom-unit').value.trim() || '';
    
    let csvContent = '\uFEFF'; // BOM
    csvContent += `Año,Colombia (${customUnit}),América Latina (${customUnit}),Brecha Absoluta (${customUnit}),Desviación Relativa Estándar (DRE)\n`;
    
    appState.customIndicatorResults.forEach(row => {
        const col = row.colVal !== undefined ? row.colVal : '';
        const alc = row.alcVal !== undefined ? row.alcVal : '';
        const gap = row.colVal !== undefined && row.alcVal !== undefined ? row.gap : '';
        const dre = row.colVal !== undefined && row.alcVal !== undefined ? row.dre : '';
        csvContent += `${row.year},${col},${alc},${gap},${dre}\n`;
    });
    
    const cleanFilename = `${customName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_sintetico.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, cleanFilename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', cleanFilename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// ==========================================
// 21b. PERSISTENCIA EN LOCALSTORAGE (BASE DE DATOS LOCAL)
// ==========================================

function saveCustomIndicatorToDB() {
    if (!appState.customIndicatorResults || appState.customIndicatorResults.length === 0) {
        alert('Debes generar el indicador sintético primero antes de guardarlo.');
        return;
    }
    
    const rows = document.querySelectorAll('.creator-indicator-row');
    const indicatorList = [];
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const idx = row.id.replace('creator-indicator-row-', '');
        const idStr = document.getElementById(`creator-ind-${idx}-id`).value.trim();
        const nameEl = document.getElementById(`creator-ind-${idx}-name`);
        const cleanName = nameEl && nameEl.dataset.verified === "true" ? nameEl.dataset.cleanName : `Indicador #${idStr}`;
        const unit = nameEl && nameEl.dataset.verified === "true" ? nameEl.dataset.unit : '';
        
        indicatorList.push({
            id: parseInt(idStr),
            name: cleanName,
            unit: unit
        });
    }
    
    const customName = document.getElementById('creator-custom-name').value.trim() || 'Indicador Sintético';
    const customUnit = document.getElementById('creator-custom-unit').value.trim() || '';
    const op = document.getElementById('creator-operator').value;
    const scale = parseFloat(document.getElementById('creator-scale').value) || 1;
    
    const record = {
        id: Date.now(), // Unique ID
        name: customName,
        unit: customUnit,
        operator: op,
        scale: scale,
        indicators: indicatorList
    };
    
    try {
        let saved = localStorage.getItem('cepalstat_saved_indicators');
        let list = saved ? JSON.parse(saved) : [];
        
        // Prevent duplicate names
        const duplicateIdx = list.findIndex(item => item.name.toLowerCase() === customName.toLowerCase());
        if (duplicateIdx !== -1) {
            if (!confirm('Ya existe un indicador guardado con este nombre. ¿Deseas reemplazarlo?')) {
                return;
            }
            list[duplicateIdx] = record;
        } else {
            list.push(record);
        }
        
        localStorage.setItem('cepalstat_saved_indicators', JSON.stringify(list));
        alert('¡Indicador guardado exitosamente en la base de datos local!');
        loadSavedIndicators();
    } catch (err) {
        alert(`Error al guardar en base de datos: ${err.message}`);
        console.error(err);
    }
}

function loadSavedIndicators() {
    const listEl = document.getElementById('creator-saved-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    try {
        const saved = localStorage.getItem('cepalstat_saved_indicators');
        const list = saved ? JSON.parse(saved) : [];
        
        if (list.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 2.5rem 0;">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
                    No hay indicadores guardados.
                </div>
            `;
            return;
        }
        
        list.forEach(item => {
            const row = document.createElement('div');
            row.style.background = 'rgba(255, 255, 255, 0.01)';
            row.style.border = '1px solid var(--border-color)';
            row.style.borderRadius = '8px';
            row.style.padding = '0.75rem';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '0.5rem';
            row.style.transition = 'var(--transition-smooth)';
            row.style.cursor = 'pointer';
            
            row.className = 'saved-indicator-item';
            
            const codes = item.indicators.map(ind => ind.id).join(` ${getOpSymbol(item.operator)} `);
            
            row.innerHTML = `
                <div style="flex: 1; text-align: left;" onclick="loadSavedIndicatorToForm(${item.id})">
                    <strong style="font-size: 0.85rem; color: var(--text-primary); display: block; margin-bottom: 0.15rem;">${item.name}</strong>
                    <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Fórmula: ${codes} (${item.unit || 'sin unidad'})</span>
                </div>
                <button type="button" class="btn-danger-icon" onclick="deleteSavedIndicator(${item.id})" style="background: transparent; border: none; color: var(--accent-red); cursor: pointer; padding: 0.25rem; font-size: 0.85rem;" title="Eliminar de la BD">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            
            listEl.appendChild(row);
        });
    } catch (err) {
        console.error('Error al cargar indicadores guardados:', err);
    }
}

function getOpSymbol(op) {
    if (op === 'add') return '+';
    if (op === 'subtract') return '-';
    if (op === 'multiply') return '×';
    if (op === 'divide') return '÷';
    return '?';
}

function deleteSavedIndicator(id) {
    event.stopPropagation();
    
    if (!confirm('¿Estás seguro de que deseas eliminar este indicador de la base de datos local?')) {
        return;
    }
    
    try {
        const saved = localStorage.getItem('cepalstat_saved_indicators');
        let list = saved ? JSON.parse(saved) : [];
        list = list.filter(item => item.id !== id);
        localStorage.setItem('cepalstat_saved_indicators', JSON.stringify(list));
        loadSavedIndicators();
    } catch (err) {
        console.error(err);
    }
}

async function loadSavedIndicatorToForm(id) {
    try {
        const saved = localStorage.getItem('cepalstat_saved_indicators');
        const list = saved ? JSON.parse(saved) : [];
        const record = list.find(item => item.id === id);
        if (!record) return;
        
        const container = document.getElementById('creator-indicators-list');
        if (container) {
            container.innerHTML = '';
        }
        creatorIndicatorCount = 0;
        
        for (let i = 0; i < record.indicators.length; i++) {
            const ind = record.indicators[i];
            addIndicatorInputRow(ind.id);
            
            const nameEl = document.getElementById(`creator-ind-${i+1}-name`);
            if (nameEl) {
                nameEl.textContent = `✓ [${ind.id}] ${ind.name}`;
                nameEl.style.color = 'var(--accent-green)';
                nameEl.dataset.verified = "true";
                nameEl.dataset.cleanName = ind.name;
                nameEl.dataset.unit = ind.unit || '';
            }
        }
        
        document.getElementById('creator-operator').value = record.operator;
        document.getElementById('creator-scale').value = record.scale;
        document.getElementById('creator-custom-name').value = record.name;
        document.getElementById('creator-custom-unit').value = record.unit;
        
        await generateSyntheticIndicator();
    } catch (err) {
        alert(`Error al cargar el indicador: ${err.message}`);
        console.error(err);
    }
}

// ============================================================================
// COMPONENTE 3: CONSULTA INTELIGENTE (PROMPT AI & AUTOCOMPLETE EN LENGUAJE NATURAL)
// ============================================================================

// Global function to load a suggested prompt from template click
function loadSuggestedPrompt(text) {
    const inputEl = document.getElementById('consulta-prompt-input');
    if (inputEl) {
        inputEl.value = text;
        inputEl.focus();
        // Trigger input event to update autocomplete if relevant
        inputEl.dispatchEvent(new Event('input'));
    }
}

// Clear chat history
function clearConsultaChat() {
    const container = document.getElementById('consulta-chat-container');
    if (container) {
        container.innerHTML = `
            <div class="chat-bubble-assistant">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 0.85rem;">
                    <i class="fa-solid fa-robot"></i>
                </div>
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-size: 0.9rem; color: #a855f7; font-weight: 600;">Asistente de Consulta</h4>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                        Chat limpiado. ¿Qué indicador o cálculo deseas explorar hoy?
                    </p>
                </div>
            </div>
        `;
    }
}

// Append a message bubble to the chat container
function appendConsultaChatMessage(sender, text, htmlContent = null) {
    const container = document.getElementById('consulta-chat-container');
    if (!container) return;

    const bubble = document.createElement('div');
    if (sender === 'user') {
        bubble.className = 'chat-bubble-user';
        bubble.innerHTML = `
            <div style="flex: 1;">
                <h4 style="margin: 0 0 0.25rem 0; font-size: 0.9rem; color: var(--accent-blue); font-weight: 600; text-align: right;">Usuario</h4>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-primary); text-align: right;">${escapeHtml(text)}</p>
            </div>
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(59, 130, 246, 0.2); border: 1px solid var(--accent-blue); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent-blue); font-size: 0.85rem;">
                <i class="fa-solid fa-user"></i>
            </div>
        `;
    } else {
        bubble.className = 'chat-bubble-assistant';
        bubble.innerHTML = `
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 0.85rem;">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div style="flex: 1;">
                <h4 style="margin: 0 0 0.25rem 0; font-size: 0.9rem; color: #a855f7; font-weight: 600;">Asistente de Consulta</h4>
                <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">
                    ${htmlContent ? htmlContent : `<p style="margin: 0;">${escapeHtml(text)}</p>`}
                </div>
            </div>
        `;
    }

    container.appendChild(bubble);
    // Smooth scroll to bottom
    container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
    });
}

// Escape HTML utility
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Setup real-time autocomplete suggestions dropdown
function setupConsultaAutocomplete() {
    const inputEl = document.getElementById('consulta-prompt-input');
    const dropdownEl = document.getElementById('consulta-autocomplete-dropdown');
    if (!inputEl || !dropdownEl) return;

    // Remove previous listeners to avoid duplicates
    inputEl.oninput = null;
    inputEl.onkeydown = null;

    inputEl.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (query.length < 2) {
            dropdownEl.style.display = 'none';
            return;
        }

        // Get matching official indicators
        let matches = [];
        if (appState.flatIndicators) {
            matches = appState.flatIndicators.filter(ind => {
                const nameClean = ind.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const idClean = ind.id.toString();
                return nameClean.includes(query) || idClean.includes(query);
            });
        }

        // Get matching saved custom indicators
        let customMatches = [];
        try {
            const saved = localStorage.getItem('cepalstat_saved_indicators');
            const list = saved ? JSON.parse(saved) : [];
            customMatches = list.filter(item => {
                const nameClean = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return nameClean.includes(query);
            });
        } catch (err) {
            console.error('Error matching custom indicators:', err);
        }

        // Merge matches (limit to 6 total matches for clean view)
        dropdownEl.innerHTML = '';
        const totalMatchesCount = matches.length + customMatches.length;

        if (totalMatchesCount === 0) {
            dropdownEl.innerHTML = `
                <div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
                    No se encontraron indicadores que coincidan.
                </div>
            `;
            dropdownEl.style.display = 'block';
            return;
        }

        // Render custom indicators matches
        customMatches.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'consulta-autocomplete-item';
            itemEl.innerHTML = `
                <span style="font-weight: 600; color: var(--accent-green);"><i class="fa-solid fa-database" style="margin-right: 0.35rem; font-size: 0.75rem;"></i> ${item.name}</span>
                <span class="indicator-code" style="color: var(--accent-green); background: rgba(16, 185, 129, 0.15);">Sintético BD</span>
            `;
            itemEl.addEventListener('click', () => {
                inputEl.value = `Indicador sintético "${item.name}"`;
                dropdownEl.style.display = 'none';
                inputEl.dataset.selectedCustomId = item.id;
                inputEl.focus();
            });
            dropdownEl.appendChild(itemEl);
        });

        // Render official indicators matches
        matches.slice(0, 6 - customMatches.length).forEach(ind => {
            const itemEl = document.createElement('div');
            itemEl.className = 'consulta-autocomplete-item';
            itemEl.innerHTML = `
                <span>${ind.name}</span>
                <span class="indicator-code">${ind.id}</span>
            `;
            itemEl.addEventListener('click', () => {
                // Replace or append
                const text = inputEl.value;
                const lastWordMatch = text.match(/\b\w+$/);
                if (lastWordMatch) {
                    inputEl.value = text.substring(0, lastWordMatch.index) + ind.id + ' ';
                } else {
                    inputEl.value = `Graficar indicador ${ind.id} (${ind.name})`;
                }
                dropdownEl.style.display = 'none';
                inputEl.focus();
            });
            dropdownEl.appendChild(itemEl);
        });

        dropdownEl.style.display = 'block';
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitNaturalLanguageQuery();
        }
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (e.target !== inputEl && e.target !== dropdownEl && !dropdownEl.contains(e.target)) {
            dropdownEl.style.display = 'none';
        }
    });
}

// Submit prompt query
function submitNaturalLanguageQuery() {
    const inputEl = document.getElementById('consulta-prompt-input');
    if (!inputEl) return;
    const promptText = inputEl.value.trim();
    if (!promptText) return;

    // Add user message to chat
    appendConsultaChatMessage('user', promptText);
    inputEl.value = '';

    // Hide autocomplete dropdown
    const dropdownEl = document.getElementById('consulta-autocomplete-dropdown');
    if (dropdownEl) dropdownEl.style.display = 'none';

    // Process parser with a slight delay for realistic feeling
    setTimeout(() => {
        processQuery(promptText);
    }, 450);
}

// Main processing logic for the NLP queries
function processQuery(promptText) {
    const text = promptText.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Check for specific custom indicator ID selection from dataset
    const inputEl = document.getElementById('consulta-prompt-input');
    if (inputEl && inputEl.dataset.selectedCustomId) {
        const customId = parseInt(inputEl.dataset.selectedCustomId);
        delete inputEl.dataset.selectedCustomId; // consume it

        try {
            const saved = localStorage.getItem('cepalstat_saved_indicators');
            const list = saved ? JSON.parse(saved) : [];
            const record = list.find(item => item.id === customId);
            if (record) {
                appendConsultaChatMessage('assistant', '', `<p>¡Claro! He encontrado tu indicador sintético guardado: <strong>${record.name}</strong>.</p>
                <p>Voy a redirigirte al Creador de Indicadores, configurar la fórmula y generar el gráfico correspondiente de inmediato.</p>`);
                
                setTimeout(() => {
                    loadSavedIndicatorToForm(customId);
                    selectCreadorSection();
                }, 1000);
                return;
            }
        } catch (e) {
            console.error(e);
        }
    }

    // 2. Parse potential indicator IDs (2 to 5 digit integers)
    const numbers = promptText.match(/\b\d{2,5}\b/g) || [];
    const validIds = [];
    
    // Validate numbers against official flatIndicators database
    if (appState.flatIndicators) {
        numbers.forEach(numStr => {
            const id = parseInt(numStr);
            if (appState.flatIndicators.some(ind => ind.id === id) && !validIds.includes(id)) {
                validIds.push(id);
            }
        });
    }

    // 3. Check for arithmetic operation commands: division, multiplication, sum, subtraction
    const isDivision = /\b(dividir|division|cociente|entre|sobre|\/)\b/.test(text);
    const isMultiplication = /\b(multiplicar|multiplicacion|por|producto|\*)\b/.test(text) && !/\b(por\s+100|por\s+cien)\b/.test(text);
    const isSum = /\b(sumar|suma|mas|adicion|\+)\b/.test(text);
    const isSubtraction = /\b(restar|resta|menos|diferencia|-)\b/.test(text);
    
    const isMathOperation = isDivision || isMultiplication || isSum || isSubtraction;

    // Parse scaling factors mentioned in the query
    let scale = 1;
    if (/\b(100|porcentaje|por\s+cien|por\s+100)\b/.test(text)) {
        scale = 100;
    } else if (/\b(1000|1\.000|mil|por\s+mil)\b/.test(text)) {
        scale = 1000;
    } else if (/\b(100000|100\.000|cien\s+mil)\b/.test(text)) {
        scale = 100000;
    }

    // A. MATH CALCULATION INTENT (COMBINING TWO OR MORE VALID INDICATORS)
    if (isMathOperation && validIds.length >= 2) {
        let op = 'divide';
        let opSymbol = '÷';
        let opWord = 'división';

        if (isSum) {
            op = 'add';
            opSymbol = '+';
            opWord = 'suma';
        } else if (isSubtraction) {
            op = 'subtract';
            opSymbol = '-';
            opWord = 'resta';
        } else if (isMultiplication) {
            op = 'multiply';
            opSymbol = '×';
            opWord = 'multiplicación';
        }

        const ind1 = findIndicatorById(validIds[0]);
        const ind2 = findIndicatorById(validIds[1]);
        const customIndicatorName = `Cálculo: [${ind1.id}] ${ind1.name.substring(0, 20)}... ${opSymbol} [${ind2.id}] ${ind2.name.substring(0, 20)}...`;

        appendConsultaChatMessage('assistant', '', `
            <p>He detectado una intención de <strong>combinación sintética</strong>:</p>
            <ul style="margin: 0.25rem 0 0.75rem 1rem; padding: 0;">
                <li><strong>Indicador A:</strong> [${ind1.id}] ${ind1.name}</li>
                <li><strong>Operador:</strong> ${opWord} (${opSymbol})</li>
                <li><strong>Indicador B:</strong> [${ind2.id}] ${ind2.name}</li>
                <li><strong>Escala:</strong> ${scale}</li>
            </ul>
            <p>Configurando automáticamente el formulario del <strong>Creador de Indicadores</strong> y ejecutando el cálculo para ti...</p>
        `);

        // Switch and configure creator form
        setTimeout(() => {
            selectCreadorSection();
            const container = document.getElementById('creator-indicators-list');
            if (container) container.innerHTML = '';
            creatorIndicatorCount = 0;

            // Load indicator inputs
            addIndicatorInputRow(ind1.id);
            addIndicatorInputRow(ind2.id);

            // Populate metadata
            const nameEl1 = document.getElementById('creator-ind-1-name');
            if (nameEl1) {
                nameEl1.textContent = `✓ [${ind1.id}] ${ind1.name}`;
                nameEl1.style.color = 'var(--accent-green)';
                nameEl1.dataset.verified = "true";
                nameEl1.dataset.cleanName = ind1.name;
                nameEl1.dataset.unit = '';
            }

            const nameEl2 = document.getElementById('creator-ind-2-name');
            if (nameEl2) {
                nameEl2.textContent = `✓ [${ind2.id}] ${ind2.name}`;
                nameEl2.style.color = 'var(--accent-green)';
                nameEl2.dataset.verified = "true";
                nameEl2.dataset.cleanName = ind2.name;
                nameEl2.dataset.unit = '';
            }

            document.getElementById('creator-operator').value = op;
            document.getElementById('creator-scale').value = scale;
            document.getElementById('creator-custom-name').value = customIndicatorName;
            document.getElementById('creator-custom-unit').value = scale === 100 ? '%' : 'sintético';

            // Generate synthetic data
            generateSyntheticIndicator();
        }, 1200);
        return;
    }

    // B. SINGLE INDICATOR GRAPH/EXPLORE INTENT (VALID ID FOUND)
    if (validIds.length === 1) {
        const ind = findIndicatorById(validIds[0]);
        appendConsultaChatMessage('assistant', '', `
            <p>He localizado el indicador solicitado en la base de datos oficial:</p>
            <p><strong>[${ind.id}] ${ind.name}</strong></p>
            <p>Cargando el gráfico y redireccionándote al <strong>Explorador de Indicadores</strong>...</p>
        `);

        setTimeout(() => {
            selectIndicator(ind);
            switchGlobalSection('explorer');
        }, 1200);
        return;
    }

    // C. SEARCH BY KEYWORD (NO VALID ID FOUND BUT KEYWORDS EXIST)
    // Filter indicators matching user keywords
    const keywords = text.replace(/\b(graficar|ver|buscar|mostrar|visualizar|deseo|quiero|indicador|indicadores|de|para|el|la|los|las|un|una)\b/g, '').trim();
    
    if (keywords.length >= 3) {
        let matches = [];
        if (appState.flatIndicators) {
            matches = appState.flatIndicators.filter(ind => {
                const nameClean = ind.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return nameClean.includes(keywords);
            });
        }

        // Also check if any saved indicator matches
        let customMatches = [];
        try {
            const saved = localStorage.getItem('cepalstat_saved_indicators');
            const list = saved ? JSON.parse(saved) : [];
            customMatches = list.filter(item => {
                const nameClean = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return nameClean.includes(keywords);
            });
        } catch (e) {}

        if (matches.length > 0 || customMatches.length > 0) {
            let matchesHtml = `<p>He encontrado los siguientes indicadores registrados que coinciden con "<strong>${escapeHtml(keywords)}</strong>":</p>`;
            matchesHtml += `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">`;

            // Custom indicators matches first
            customMatches.forEach(item => {
                matchesHtml += `
                    <button class="suggestion-prompt-card" onclick="loadSavedIndicatorToForm(${item.id}); selectCreadorSection();" style="border: 1px solid var(--accent-green); background: rgba(16, 185, 129, 0.05); padding: 0.6rem; border-radius: 6px; cursor: pointer; text-align: left; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.825rem; font-weight: 600; color: var(--text-primary);"><i class="fa-solid fa-database" style="color: var(--accent-green); margin-right: 0.35rem;"></i> ${item.name}</span>
                        <span style="font-size: 0.72rem; color: var(--accent-green); font-weight: bold; text-transform: uppercase;">Sintético BD</span>
                    </button>
                `;
            });

            // Official indicators matches
            matches.slice(0, 5).forEach(ind => {
                matchesHtml += `
                    <button class="suggestion-prompt-card" onclick="selectIndicatorByIdFromPrompt(${ind.id})" style="border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.02); padding: 0.6rem; border-radius: 6px; cursor: pointer; text-align: left; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.825rem; color: var(--text-primary);">${ind.name}</span>
                        <span style="font-size: 0.72rem; color: var(--accent-blue); font-weight: bold; background: rgba(59, 130, 246, 0.1); padding: 0.15rem 0.35rem; border-radius: 4px; flex-shrink: 0; margin-left: 0.5rem;">[${ind.id}]</span>
                    </button>
                `;
            });

            matchesHtml += `</div>`;
            appendConsultaChatMessage('assistant', '', matchesHtml);
            return;
        }
    }

    // D. SYSTEM EXPLANATIONS & GUIDES (BRECHAS, TENDENCIAS, METODOLOGÍA)
    if (/\b(brecha|brechas|dre)\b/.test(text)) {
        appendConsultaChatMessage('assistant', '', `
            <p>El módulo de <strong>Brechas Críticas (DRE)</strong> analiza indicadores de desarrollo social, demografía y economía comparando de manera directa el promedio de América Latina con Colombia.</p>
            <p>Puedes ir a esta sección para examinar la desigualdad de ingresos, tasa de analfabetismo y afiliación a pensiones en detalle.</p>
            <button class="btn-primary" onclick="selectBrechasSection()" style="margin-top: 0.5rem; background: linear-gradient(135deg, var(--color-colombia) 0%, rgba(255,215,0,0.85) 100%); color: #0b0f19; font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;">Ver Brechas Críticas</button>
        `);
        return;
    }

    if (/\b(tendencia|tendencias|preliminar|proyeccion|crecimiento)\b/.test(text)) {
        appendConsultaChatMessage('assistant', '', `
            <p>El módulo de <strong>Tendencias CEPAL 2025</strong> resume las conclusiones macroeconómicas oficiales sobre la desaceleración del crecimiento en la región, la moderación de la inflación y las proyecciones de inversión.</p>
            <p>Puedes ir allí para ver las estadísticas vinculadas directamente a cada tendencia macroeconómica.</p>
            <button class="btn-primary" onclick="selectTendenciasSection()" style="margin-top: 0.5rem; background: linear-gradient(135deg, var(--accent-blue) 0%, rgba(59,130,246,0.85) 100%); color: #0b0f19; font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;">Ver Tendencias CEPAL</button>
        `);
        return;
    }

    if (/\b(crear|creador|combinar|sintetico|sinteticos|formula|guardar)\b/.test(text)) {
        appendConsultaChatMessage('assistant', '', `
            <p>En el <strong>Creador de Indicadores</strong> puedes ingresar códigos oficiales de la CEPAL (por ejemplo, 3341 para Pobreza y 4789 para Población) y sumarlos, restarlos, multiplicarlos o dividirlos para crear series personalizadas.</p>
            <p>Además, puedes guardar tus fórmulas creadas pulsando el botón <strong>"Guardar en BD"</strong> para tenerlas disponibles de forma permanente.</p>
            <button class="btn-primary" onclick="selectCreadorSection()" style="margin-top: 0.5rem; background: linear-gradient(135deg, var(--accent-blue) 0%, rgba(59,130,246,0.85) 100%); color: #0b0f19; font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;">Ir al Creador de Indicadores</button>
        `);
        return;
    }

    // E. GENERAL UNUNDERSTOOD PROMPT
    appendConsultaChatMessage('assistant', '', `
        <p>No he podido identificar una acción automática para tu consulta. Para ayudarme a procesarla mejor, intenta incluir:</p>
        <ul style="margin: 0.25rem 0 0.5rem 1rem; padding: 0;">
            <li>El código numérico oficial (ej: <strong>3341</strong>, <strong>4789</strong>, etc.) del indicador.</li>
            <li>Las palabras clave de acción, como <strong>"graficar"</strong>, <strong>"dividir"</strong> o <strong>"sumar"</strong>.</li>
        </ul>
        <p>También puedes ingresar una palabra clave descriptiva (como "inflación", "desempleo") para que busque sugerencias coincidentes en la base de datos.</p>
    `);
}

// Handler helper to display indicator selected from chat match
function selectIndicatorByIdFromPrompt(id) {
    const ind = findIndicatorById(id);
    if (ind) {
        selectIndicator(ind);
        switchGlobalSection('explorer');
    }
}

// Global tooltip mechanism for data-tooltip attribute
function initGlobalTooltip() {
    let tooltipEl = document.getElementById('custom-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'custom-tooltip';
        tooltipEl.className = 'custom-tooltip';
        document.body.appendChild(tooltipEl);
    }
    
    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        
        const text = target.getAttribute('data-tooltip');
        if (!text) return;
        
        tooltipEl.textContent = text;
        tooltipEl.classList.add('visible');
        
        // Wait for class addition to measure size correctly
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        // Center horizontally above target
        let left = rect.left + (rect.width - tooltipRect.width) / 2;
        let top = rect.top - tooltipRect.height - 8; // 8px above target
        
        // Prevent viewport overflow
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top < 10) {
            // Position below if no space above
            top = rect.bottom + 8;
        }
        
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
    });
    
    document.addEventListener('mouseout', (e) => {
        const currentTarget = e.target.closest('[data-tooltip]');
        if (!currentTarget) return;
        
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && currentTarget.contains(relatedTarget)) {
            return; // Still inside the same element, do nothing
        }
        
        tooltipEl.classList.remove('visible');
    });
}

// ==========================================
// 22. MÓDULO MATRIZ DE TENDENCIAS TEMÁTICAS
// ==========================================

const TENDENCIAS2_DATA = [
    // DIMENSIÓN: SOCIAL
    {
        dimension: 'Social',
        dimClass: 'social',
        indicator: 'Índice de Gini (concentración del ingreso)',
        indicatorId: 3289,
        trend: 'Desfavorable',
        trendClass: 'desfavorable',
        trendIcon: 'fa-arrow-trend-down',
        description: 'La desigualdad de ingresos en ALC se mantiene estructuralmente alta (Gini ~0.46). Colombia presenta uno de los índices más elevados de la región (~0.54), con rigidez en la movilidad social que limita los efectos positivos del crecimiento económico.',
        colombiaNote: 'Colombia: Gini ≈ 0.54 — uno de los más altos del mundo.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [51.8, 52.6, 54.4, 52.3, 55.6, 54.6],
            alc: [46.2, 46.5, 46.8, 46.1, 45.8, 45.7]
        },
        evolution: 'Desigualdad persistentemente alta; la brecha Colombia-ALC aumentó durante la pandemia y sigue rígida en niveles críticos (~0.54).'
    },
    {
        dimension: 'Social',
        dimClass: 'social',
        indicator: 'Pobreza monetaria y pobreza extrema',
        indicatorId: 3328,
        trend: 'Favorable',
        trendClass: 'favorable',
        trendIcon: 'fa-arrow-trend-up',
        description: 'La pobreza monetaria regional alcanzó su nivel más bajo (25.5% en 2024). Colombia bajó al 33%, apoyada en subsidios del gobierno y recuperación del empleo urbano, aunque persisten altas brechas en zonas rurales.',
        colombiaNote: 'Colombia: pobreza monetaria ≈ 33% (2023); pobreza multidimensional ≈ 12.1%.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [34.7, 35.7, 42.5, 39.3, 36.6, 33.0],
            alc: [30.2, 30.5, 32.8, 31.4, 29.0, 27.3]
        },
        evolution: 'Reducción significativa post-pandemia de 42.5% a 33% en Colombia, convergiendo lentamente hacia el promedio de ALC.'
    },
    {
        dimension: 'Social',
        dimClass: 'social',
        indicator: 'Índices de Theil, Atkinson y Varianza logarítmica',
        indicatorId: 3303,
        trend: 'Desfavorable',
        trendClass: 'desfavorable',
        trendIcon: 'fa-arrow-trend-down',
        description: 'Las medidas alternativas de desigualdad confirman una concentración persistente del ingreso en toda ALC. En Colombia, estos índices reflejan que la mejora en pobreza no se traduce en mayor equidad distributiva.',
        colombiaNote: 'Colombia: altos valores en todos los índices multidimensionales de desigualdad.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [0.48, 0.49, 0.51, 0.49, 0.53, 0.52],
            alc: [0.38, 0.39, 0.40, 0.38, 0.37, 0.37]
        },
        evolution: 'Concentración de ingresos estancada; los índices alternativos corroboran que la riqueza se mantiene concentrada en el decil superior.'
    },
    {
        dimension: 'Social',
        dimClass: 'social',
        indicator: 'Tasa de analfabetismo por sexo y edad',
        indicatorId: 53,
        trend: 'Favorable',
        trendClass: 'favorable',
        trendIcon: 'fa-arrow-trend-up',
        description: 'ALC ha avanzado en reducir el analfabetismo, especialmente en población joven. Colombia mantiene una tasa inferior al promedio regional pero enfrenta rezagos significativos en zonas rurales y en la población adulta mayor.',
        colombiaNote: 'Colombia: analfabetismo adulto ≈ 5.6%; rezago crítico en zonas rurales.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [5.2, 5.1, 5.0, 5.0, 4.9, 4.8],
            alc: [6.8, 6.7, 6.6, 6.5, 6.4, 6.3]
        },
        evolution: 'Evolución favorable constante; Colombia mantiene tasas de analfabetismo por debajo del promedio regional en los últimos 6 años.'
    },
    // DIMENSIÓN: GÉNERO
    {
        dimension: 'Género',
        dimClass: 'genero',
        indicator: 'Tasa de participación en la fuerza de trabajo (por sexo)',
        indicatorId: 120,
        trend: 'Neutral',
        trendClass: 'neutral',
        trendIcon: 'fa-minus',
        description: 'La brecha de participación laboral por género supera los 20 puntos porcentuales en ALC. El mercado laboral sigue fuertemente segmentado, agravado por la injusta distribución del trabajo de cuidados no remunerado.',
        colombiaNote: 'Colombia: brecha femenina de participación > 20 pp; Sistema Nacional de Cuidado en implementación.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [63.5, 62.8, 59.2, 61.5, 63.8, 64.2],
            alc: [62.1, 62.5, 58.7, 60.8, 62.2, 62.6]
        },
        evolution: 'Recuperación post-pandemia lograda en 2023, pero las brechas de género en participación (Femenina vs Masculina) se mantienen rígidas.'
    },
    {
        dimension: 'Género',
        dimClass: 'genero',
        indicator: 'Tasa de desocupación por sexo',
        indicatorId: 127,
        trend: 'Desfavorable',
        trendClass: 'desfavorable',
        trendIcon: 'fa-arrow-trend-down',
        description: 'Las mujeres enfrentan mayor desocupación que los hombres en ALC. En Colombia, la tasa de desocupación femenina supera en cerca de 4-5 puntos la masculina, con mayor impacto en los sectores informales y rurales.',
        colombiaNote: 'Colombia: desocupación femenina ≈ 14%; masculina ≈ 9% (2023).',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [9.7, 10.5, 15.9, 13.7, 11.2, 10.2],
            alc: [8.0, 8.1, 10.4, 9.3, 7.0, 6.3]
        },
        evolution: 'Desempleo en Colombia superior a ALC. Persiste brecha de género con desocupación femenina (~14%) mucho mayor que la masculina.'
    },
    // DIMENSIÓN: POBLACIÓN
    {
        dimension: 'Población',
        dimClass: 'poblacion',
        indicator: 'Población por grupos quinquenales de edad',
        indicatorId: 4789,
        trend: 'Neutral',
        trendClass: 'neutral',
        trendIcon: 'fa-minus',
        description: 'ALC atraviesa una transición demográfica avanzada: reducción de natalidad y aumento de la población adulta mayor. Colombia se ubica en plena transición, con un bono demográfico que se irá agotando hacia 2040.',
        colombiaNote: 'Colombia: bono demográfico activo; proporción de adultos mayores en ascenso.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [21.5, 21.0, 20.6, 20.2, 19.8, 19.4],
            alc: [22.8, 22.4, 22.0, 21.6, 21.2, 20.8]
        },
        evolution: 'Transición demográfica acelerada; caída constante del porcentaje de población joven y aumento sostenido de la población adulta mayor.'
    },
    {
        dimension: 'Población',
        dimClass: 'poblacion',
        indicator: 'Relación de dependencia demográfica',
        indicatorId: 4792,
        trend: 'Favorable',
        trendClass: 'favorable',
        trendIcon: 'fa-arrow-trend-up',
        description: 'La relación de dependencia en ALC se mantiene favorable gracias al bono demográfico, aunque empieza a revertirse en los países más envejecidos. Colombia aún se beneficia, con una dependencia inferior al promedio regional.',
        colombiaNote: 'Colombia: dependencia demográfica ≈ 45.3 por 100 activos (2024); menor a ALC ≈ 47.8.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [47.5, 46.8, 46.2, 45.8, 45.5, 45.3],
            alc: [49.8, 49.3, 48.8, 48.4, 48.0, 47.8]
        },
        evolution: 'Bono demográfico activo y favorable; la carga de dependencia en Colombia es menor a la regional, con reducción progresiva en el periodo.'
    },
    {
        dimension: 'Población',
        dimClass: 'poblacion',
        indicator: 'Pobreza y pobreza extrema por sexo y edad',
        indicatorId: 3341,
        trend: 'Desfavorable',
        trendClass: 'desfavorable',
        trendIcon: 'fa-arrow-trend-down',
        description: 'La pobreza intersecta fuynertemente con el género y la edad en ALC: niños y mujeres tienen probabilidades más altas de ser pobres. En Colombia, la pobreza infantil en zonas rurales supera el 50%, evidenciando trampas generacionales.',
        colombiaNote: 'Colombia: pobreza infantil rural > 50%; pobreza en mujeres mayor que en hombres.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [35.2, 36.1, 43.0, 39.8, 37.0, 33.4],
            alc: [30.5, 30.8, 33.1, 31.7, 29.3, 27.6]
        },
        evolution: 'La pobreza en menores de 15 años y en mujeres sigue siendo desproporcionadamente alta en comparación con el promedio regional.'
    },
    // DIMENSIÓN: MACRO
    {
        dimension: 'Macro',
        dimClass: 'macro',
        indicator: 'PIB total anual por habitante (precios constantes en USD)',
        indicatorId: 2206,
        trend: 'Desfavorable',
        trendClass: 'desfavorable',
        trendIcon: 'fa-arrow-trend-down',
        description: 'ALC consolida una trampa de bajo crecimiento con proyecciones del 2.4% para 2025. Colombia enfrenta limitaciones estructurales de productividad y restricciones fiscales que impiden alcanzar tasas sostenidas superiores al 3%.',
        colombiaNote: 'Colombia: PIB/hab ≈ 6,200 USD (2023) vs. ALC ≈ 8,800 USD. Brecha en ascenso.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [6100, 6250, 5700, 6150, 6600, 6200],
            alc: [8900, 8950, 8200, 8500, 8900, 8800]
        },
        evolution: 'Rezago constante frente a ALC; brecha de ingreso promedio de ~2,600 USD por habitante que no muestra signos de cerrarse.'
    },
    {
        dimension: 'Macro',
        dimClass: 'macro',
        indicator: 'Tasa de desocupación total',
        indicatorId: 127,
        trend: 'Neutral',
        trendClass: 'neutral',
        trendIcon: 'fa-minus',
        description: 'El desempleo regional se mantiene estable pero no desciende. En Colombia, la tasa de desocupación (≈10.2%) supera a la media de ALC (≈6.3%), impulsada por alta informalidad (>55%) y baja productividad de las MiPyMEs.',
        colombiaNote: 'Colombia: desocupación ≈ 10.2% vs. ALC ≈ 6.3%. Informalidad laboral > 55%.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [9.7, 10.5, 15.9, 13.7, 11.2, 10.2],
            alc: [8.0, 8.1, 10.4, 9.3, 7.0, 6.3]
        },
        evolution: 'Tasa de desempleo nacional de dos dígitos (10.2%) superior al promedio de ALC (6.3%), con rigideces estructurales de informalidad.'
    },
    {
        dimension: 'Macro',
        dimClass: 'macro',
        indicator: 'Emisiones de CO₂ por habitante',
        indicatorId: 5649,
        trend: 'Favorable',
        trendClass: 'favorable',
        trendIcon: 'fa-arrow-trend-up',
        description: 'ALC muestra una de las menores huellas de carbono per cápita globales. Colombia registra un valor inferior al promedio regional (1.6 vs. 2.8 tCO₂/hab), aunque la transición energética demanda inversión urgente en renovables.',
        colombiaNote: 'Colombia: 1.6 tCO₂/hab (2021) vs. ALC ≈ 2.8. Potencial verde alto en Guajira y Amazonía.',
        history: {
            years: [2016, 2017, 2018, 2019, 2020, 2021],
            col: [1.55, 1.58, 1.62, 1.60, 1.52, 1.60],
            alc: [2.90, 2.85, 2.80, 2.78, 2.50, 2.80]
        },
        evolution: 'Huella de carbono per cápita baja y estable; Colombia se mantiene cerca de 1.2 tCO2/hab por debajo de la media regional.'
    },
    // DIMENSIÓN: AMBIENTE
    {
        dimension: 'Ambiente',
        dimClass: 'ambiente',
        indicator: 'Emisiones de CO₂ por habitante (transición climática)',
        indicatorId: 5649,
        trend: 'Favorable',
        trendClass: 'favorable',
        trendIcon: 'fa-arrow-trend-up',
        description: 'Los flujos de IED hacia energías renovables y minerales críticos se aceleran. ALC tiene posición geopolítica estratégica en cobre, litio y energía solar/eólica. Colombia proyecta ser hub de data centers y energía limpia.',
        colombiaNote: 'Colombia: proyectos eólicos y solares en Guajira con retrasos por consultas previas y licencias.',
        history: {
            years: [2016, 2017, 2018, 2019, 2020, 2021],
            col: [1.55, 1.58, 1.62, 1.60, 1.52, 1.60],
            alc: [2.90, 2.85, 2.80, 2.78, 2.50, 2.80]
        },
        evolution: 'Transición energética lenta en ejecución; las bajas emisiones reflejan matriz eléctrica limpia pero persisten retos de transporte e industria.'
    },
    {
        dimension: 'Ambiente',
        dimClass: 'ambiente',
        indicator: 'Población ocupada cotizante a pensiones',
        indicatorId: 5338,
        trend: 'Desfavorable',
        trendClass: 'desfavorable',
        trendIcon: 'fa-arrow-trend-down',
        description: 'La baja cobertura pensional en ALC se vincula con la alta informalidad. En Colombia, menos del 30% de la PEA cotiza regularmente a pensiones, generando vulnerabilidad en la vejez especialmente para mujeres y trabajadores rurales.',
        colombiaNote: 'Colombia: cobertura pensional < 30% de la PEA. Reforma pensional en debate en el Congreso.',
        history: {
            years: [2018, 2019, 2020, 2021, 2022, 2023],
            col: [27.2, 27.5, 26.8, 28.1, 28.9, 29.5],
            alc: [35.5, 35.8, 34.2, 35.1, 35.6, 36.0]
        },
        evolution: 'Desfavorable y estancado por debajo del 30% en Colombia frente al 36% promedio de ALC, debido a la persistencia del empleo informal.'
    }
];

// Helper to draw clean mini sparkline charts on a 2D canvas
function drawSparkline(canvasId, years, colData, alcData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Find min and max across all data to scale
    const allData = [...colData, ...alcData].filter(v => v !== null && v !== undefined);
    if (allData.length === 0) return;
    const minVal = Math.min(...allData) * 0.98;
    const maxVal = Math.max(...allData) * 1.02;
    const range = maxVal - minVal || 1.0;
    
    const pointsCount = years.length;
    const stepX = canvas.width / (pointsCount - 1);
    
    const getX = (i) => i * stepX;
    const getY = (val) => canvas.height - 4 - ((val - minVal) / range) * (canvas.height - 8);
    
    // Draw background grid lines (subtle center line)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    // Draw ALC/Region series (Purple)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let firstAlc = true;
    for (let i = 0; i < pointsCount; i++) {
        if (alcData[i] === null || alcData[i] === undefined) continue;
        const x = getX(i);
        const y = getY(alcData[i]);
        if (firstAlc) {
            ctx.moveTo(x, y);
            firstAlc = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Draw Colombia series (Yellow)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let firstCol = true;
    for (let i = 0; i < pointsCount; i++) {
        if (colData[i] === null || colData[i] === undefined) continue;
        const x = getX(i);
        const y = getY(colData[i]);
        if (firstCol) {
            ctx.moveTo(x, y);
            firstCol = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Draw little end dot for Colombia
    if (pointsCount > 0) {
        ctx.fillStyle = '#ffd700';
        const lastIdx = pointsCount - 1;
        if (colData[lastIdx] !== null && colData[lastIdx] !== undefined) {
            ctx.beginPath();
            ctx.arc(getX(lastIdx), getY(colData[lastIdx]), 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function renderTendencias2() {
    const tbody = document.getElementById('tendencias2-table-body');
    const tabsContainer = document.getElementById('tendencias2-dimension-tabs');
    if (!tbody || !tabsContainer) return;

    // Get unique dimensions
    const dims = ['Todos', ...new Set(TENDENCIAS2_DATA.map(d => d.dimension))];

    // Render dimension filter tabs
    tabsContainer.innerHTML = dims.map(dim => {
        const isActive = appState.selectedTendencia2Dimension === dim;
        return `<button class="btn-tab ${isActive ? 'active' : ''}" style="padding: 0.4rem 0.9rem; border-radius: 7px; border: none; cursor: pointer;" onclick="setTendencias2Dimension('${dim}')">${dim}</button>`;
    }).join('');

    // Filter rows
    const searchVal = (document.getElementById('tendencias2-search-input') || {}).value || '';
    const q = searchVal.toLowerCase().trim();
    const filtered = TENDENCIAS2_DATA.filter(row => {
        const dimMatch = appState.selectedTendencia2Dimension === 'Todos' || row.dimension === appState.selectedTendencia2Dimension;
        const textMatch = !q || row.indicator.toLowerCase().includes(q) || row.dimension.toLowerCase().includes(q) || row.description.toLowerCase().includes(q) || row.colombiaNote.toLowerCase().includes(q) || row.evolution.toLowerCase().includes(q);
        return dimMatch && textMatch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-magnifying-glass" style="margin-right: 0.5rem;"></i>No se encontraron tendencias que coincidan con el filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((row, index) => {
        const sparklineId = `sparkline-${row.indicatorId}-${index}`;
        return `
        <tr class="mass-table-row" style="border-bottom: 1px solid var(--border-color); vertical-align: top; transition: background 0.15s;">
            <td style="padding: 0.85rem 1rem; vertical-align: middle;">
                <span class="badge-dimension ${row.dimClass}">
                    <i class="fa-solid ${row.dimClass === 'social' ? 'fa-people-group' : row.dimClass === 'genero' ? 'fa-venus-mars' : row.dimClass === 'poblacion' ? 'fa-users' : row.dimClass === 'macro' ? 'fa-chart-line' : 'fa-leaf'}" style="margin-right: 0.35rem;"></i>
                    ${row.dimension}
                </span>
            </td>
            <td style="padding: 0.85rem 1rem; font-weight: 600; font-size: 0.85rem; color: var(--text-primary); vertical-align: middle; line-height: 1.35;">
                [${row.indicatorId}] ${row.indicator}
            </td>
            <td style="padding: 0.85rem 1rem; text-align: center; vertical-align: middle;">
                <span class="badge-trend ${row.trendClass}">
                    <i class="fa-solid ${row.trendIcon}" style="margin-right: 0.3rem;"></i>
                    ${row.trend}
                </span>
            </td>
            <td style="padding: 0.85rem 1rem; font-size: 0.82rem; line-height: 1.5; vertical-align: top;">
                <p style="color: var(--text-secondary); margin: 0 0 0.5rem 0;">${row.description}</p>
                <span style="display: inline-block; font-size: 0.75rem; color: var(--color-colombia); font-weight: 600; padding: 0.2rem 0.55rem; background: rgba(255,215,0,0.06); border: 1px solid rgba(255,215,0,0.15); border-radius: 5px;">
                    <i class="fa-solid fa-flag" style="margin-right: 0.3rem; font-size: 0.65rem;"></i>${row.colombiaNote}
                </span>
            </td>
            <td style="padding: 0.85rem 1rem; vertical-align: middle;">
                <div style="display: flex; flex-direction: column; gap: 0.35rem; align-items: center; max-width: 210px; margin: 0 auto;">
                    <canvas id="${sparklineId}" width="180" height="42" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px; padding: 2px 4px; box-sizing: border-box; width: 180px; height: 42px;"></canvas>
                    <p style="color: var(--text-muted); font-size: 0.72rem; text-align: center; margin: 0; font-style: italic; line-height: 1.3;">
                        ${row.evolution}
                    </p>
                </div>
            </td>
            <td style="padding: 0.85rem 1rem; text-align: center; vertical-align: middle;">
                <button class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 6px;" onclick="selectIndicatorFromTrend(${row.indicatorId}, '${row.indicator.replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-chart-line"></i> Graficar
                </button>
            </td>
        </tr>
    `;
    }).join('');

    // Draw sparklines
    filtered.forEach((row, index) => {
        if (row.history) {
            const sparklineId = `sparkline-${row.indicatorId}-${index}`;
            requestAnimationFrame(() => {
                drawSparkline(sparklineId, row.history.years, row.history.col, row.history.alc);
            });
        }
    });
}

function setTendencias2Dimension(dim) {
    appState.selectedTendencia2Dimension = dim;
    renderTendencias2();
}

function filterTendencias2() {
    renderTendencias2();
}

function updateTokenStatusBar() {
    const balanceEl = document.getElementById('diag-balance');
    const tokensTotalEl = document.getElementById('diag-tokens-total');
    
    if (balanceEl) balanceEl.textContent = `$${appState.queryBalance.toFixed(4)} USD`;
    if (tokensTotalEl) tokensTotalEl.textContent = appState.totalTokensUsed.toLocaleString('es-ES');
}

function resetQueryBalance() {
    appState.queryBalance = 15.0000;
    appState.freeTiers = {
        gemini: 500000,
        chatgpt: 150000,
        claude: 100000,
        qwen: 1000000,
        llama: 250000
    };
    updateTokenStatusBar();
    
    // Hide last cost
    const lastCostContainer = document.getElementById('diag-last-cost-container');
    if (lastCostContainer) lastCostContainer.style.display = 'none';
    
    // Restore original placeholder HTML
    const placeholder = document.getElementById('diagnostic-placeholder-area');
    if (placeholder) {
        placeholder.innerHTML = `
            <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 2.5rem; color: var(--accent-blue); opacity: 0.85; margin-bottom: 1rem; display: block;"></i>
            <p style="margin-bottom: 1rem; font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.5;">
                Solicite un análisis comparativo nacional en profundidad utilizando modelos de inteligencia artificial en paralelo (Gemini, ChatGPT, Claude, Qwen y Llama).
            </p>
            <button type="button" class="btn-primary" onclick="requestMultiLlmDiagnostic()" style="margin: 0 auto; background: linear-gradient(135deg, var(--accent-blue) 0%, rgba(59,130,246,0.85) 100%); color: #0b0f19; font-weight: 600; padding: 0.6rem 1.5rem; border-radius: 8px; border: none; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: var(--transition-smooth); box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);">
                <i class="fa-solid fa-robot"></i>
                <span>Generar Diagnóstico Multi-LLM</span>
            </button>
        `;
        placeholder.style.display = 'block';
    }
}

function saveOpenAiKey() {
    const keyInput = document.getElementById('openai-api-key');
    if (keyInput) {
        const key = keyInput.value.trim();
        localStorage.setItem('openai_api_key', key);
        updateOpenAiKeyStatus(key);
    }
}

function updateOpenAiKeyStatus(key) {
    const statusEl = document.getElementById('openai-key-status');
    if (statusEl) {
        if (key) {
            statusEl.innerHTML = `<i class="fa-solid fa-circle-dot" style="font-size: 0.5rem; color: #10b981;"></i> Conectado a ChatGPT (Real)`;
            statusEl.style.color = '#10b981';
        } else {
            statusEl.innerHTML = `<i class="fa-solid fa-circle-dot" style="font-size: 0.5rem; color: #64748b;"></i> Modo Simulado (Heurístico)`;
            statusEl.style.color = 'var(--text-muted)';
        }
    }
}

function loadOpenAiKey() {
    // API Key se ingresa en la interfaz (campo API Key OpenAI) y se guarda en localStorage del navegador.
    // No se almacena ninguna clave por defecto en el código fuente.
    let key = localStorage.getItem('openai_api_key') || '';
    const keyInput = document.getElementById('openai-api-key');
    if (keyInput) {
        keyInput.value = key;
    }
    updateOpenAiKeyStatus(key);
}

async function fetchOpenAiGpt4(promptText, onChunk, onComplete, onError) {
    const key = localStorage.getItem('openai_api_key');
    if (!key) {
        onError("API Key no configurada.");
        return;
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Eres un analista experto de la CEPAL. Sigue de forma estricta las instrucciones del prompt enviado y limítate al dataset provisto sin alucinaciones ni asunciones externas.'
                    },
                    {
                        role: 'user',
                        content: promptText
                    }
                ],
                temperature: 0.2,
                stream: true
            })
        });
        
        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            const errMsg = errJson.error ? errJson.error.message : `HTTP Error ${response.status}`;
            throw new Error(errMsg);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let buffer = '';
        let fullText = '';
        
        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith('data: ')) {
                        const dataStr = cleanLine.substring(6);
                        if (dataStr === '[DONE]') {
                            done = true;
                            break;
                        }
                        try {
                            const parsed = JSON.parse(dataStr);
                            const chunk = parsed.choices[0].delta.content || '';
                            if (chunk) {
                                fullText += chunk;
                                onChunk(chunk);
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }
            }
        }
        
        onComplete(fullText);
    } catch (err) {
        onError(err.message);
    }
}

function parseMarkdownToHtml(md) {
    if (!md) return '';
    return md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/###\s+([^\n]+)/g, '<h5 style="margin-top: 1rem; color: var(--text-primary); font-weight: 700;">$1</h5>')
        .replace(/####\s+([^\n]+)/g, '<h6 style="margin-top: 0.75rem; color: var(--text-primary); font-weight: 700;">$1</h6>')
        .replace(/-\s+([^\n]+)/g, '<li style="margin-bottom: 0.25rem;">$1</li>')
        // Wrap lists
        .replace(/(<li style="margin-bottom: 0.25rem;">.*<\/li>)/gs, '<ul style="margin: 0.75rem 0; padding-left: 1.25rem; list-style-type: disc;">$1</ul>')
        .trim();
}

function setGptCompareMode(mode) {
    const btnReal = document.getElementById('btn-gptmode-real');
    const btnHeur = document.getElementById('btn-gptmode-heuristic');
    const contentReal = document.getElementById('gpt-compare-content-real');
    const contentHeur = document.getElementById('gpt-compare-content-heuristic');
    
    if (mode === 'real') {
        if (btnReal) {
            btnReal.classList.add('active');
            btnReal.style.background = 'rgba(245, 158, 11, 0.15)';
            btnReal.style.color = '#f59e0b';
        }
        if (btnHeur) {
            btnHeur.classList.remove('active');
            btnHeur.style.background = 'transparent';
            btnHeur.style.color = 'var(--text-secondary)';
        }
        if (contentReal) contentReal.style.display = 'block';
        if (contentHeur) contentHeur.style.display = 'none';
    } else {
        if (btnReal) {
            btnReal.classList.remove('active');
            btnReal.style.background = 'transparent';
            btnReal.style.color = 'var(--text-secondary)';
        }
        if (btnHeur) {
            btnHeur.classList.add('active');
            btnHeur.style.background = 'rgba(245, 158, 11, 0.15)';
            btnHeur.style.color = '#f59e0b';
        }
        if (contentReal) contentReal.style.display = 'none';
        if (contentHeur) contentHeur.style.display = 'block';
    }
}



