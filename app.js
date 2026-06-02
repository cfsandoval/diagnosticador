/**
 * CEPAL Diagnostic Dashboard Application Logic
 */

// Application State
let appState = {
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
    activeTendenciaReport: 'balance_preliminar'
};

// Constants for Standard Dimensions
const COUNTRY_DIM_ID = 208;
const YEAR_DIM_ID = 29117;
const COLOMBIA_MEMBER_ID = 225;
const ALC_MEMBER_ID = 212;

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
        name: "[127] Tasa de desocupación por sexo",
        icon: "fa-briefcase",
        colVal: 10.2,
        alcVal: 6.3,
        unit: "%",
        year: 2023,
        interpretation: "Mayor desempleo en Colombia vs. la media regional"
    },
    {
        id: "dependency",
        indicatorId: 4792,
        name: "[4792] Relación de dependencia demográfica",
        icon: "fa-people-group",
        colVal: 45.3,
        alcVal: 47.8,
        unit: "por 100 activos",
        year: 2024,
        interpretation: "Menor carga de dependencia (bono demográfico favorable)"
    },
    {
        id: "poverty",
        indicatorId: 3328,
        name: "[3328] Población en situación de pobreza extrema y pobreza",
        icon: "fa-hand-holding-dollar",
        colVal: 33.0,
        alcVal: 29.0,
        unit: "%",
        year: 2022,
        interpretation: "Mayor incidencia de pobreza monetaria"
    },
    {
        id: "gdp_per_capita",
        indicatorId: 2206,
        name: "[2206] Producto interno bruto (PIB) total anual por habitante a precios constantes en dólares",
        icon: "fa-money-bill-trend-up",
        colVal: 6200,
        alcVal: 8800,
        unit: "USD/hab",
        year: 2023,
        interpretation: "Rezago en nivel de ingreso promedio frente a ALC"
    },
    {
        id: "co2_emissions",
        indicatorId: 5649,
        name: "[5649] Emisiones de dióxido de carbono (CO₂) por habitante",
        icon: "fa-cloud-showers-water",
        colVal: 1.6,
        alcVal: 2.8,
        unit: "tCO₂/hab",
        year: 2021,
        interpretation: "Menor huella de carbono per cápita en Colombia"
    }
];

// API Endpoints
const API_TREE = 'https://api-cepalstat.cepal.org/cepalstat/api/v1/thematic-tree?lang=es';
const API_DATA_BASE = 'https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator';

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchThematicTree();
    setupSearch();
    initStructuresSidebar();
    renderCriticalGaps();
    
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
            treeEl.innerHTML = '<li class="tree-loading">El árbol temático está vacío</li>';
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
function renderTree(nodes, parentEl, pathNames) {
    nodes.forEach(node => {
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
            leaf.innerHTML = `
                <i class="fa-solid fa-chart-simple tree-leaf-icon"></i>
                <span>[${node.indicator_id}] ${node.name}</span>
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
async function selectIndicator(indicator) {
    appState.selectedIndicator = indicator;
    
    // Switch section if not in explorer
    if (appState.currentGlobalSection !== 'explorer') {
        switchGlobalSection('explorer');
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
        const url = `${API_DATA_BASE}/${indicator.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudieron obtener los datos de la CEPAL');
        
        const res = await response.json();
        appState.indicatorData = res.body;
        
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
    
    document.getElementById('meta-definition').textContent = meta.description || appState.selectedIndicator.name;
    
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
    // Colombia (225) vs ALC (212)
    const colombiaData = {};
    const alcData = {};
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
        }
    });
    
    // Convert years set to sorted array
    const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedYears.length === 0) {
        showError('No hay datos disponibles para comparar Colombia y América Latina y el Caribe en los filtros seleccionados.');
        chartLoading.classList.remove('active');
        clearKpis();
        return;
    }
    
    // Build parallel series
    const colombiaSeries = sortedYears.map(yr => colombiaData[yr] !== undefined ? colombiaData[yr] : null);
    const alcSeries = sortedYears.map(yr => alcData[yr] !== undefined ? alcData[yr] : null);
    
    // Update KPI panels with the latest available year that has data for BOTH
    updateKpiCards(sortedYears, colombiaData, alcData);
    
    // Update Chart
    drawChart(sortedYears, colombiaSeries, alcSeries);
    
    // Update Table
    updateTable(sortedYears, colombiaData, alcData);
    
    // Generate Diagnostic Heuristics
    generateDiagnostic(sortedYears, colombiaData, alcData);
    
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
            const pctGap = (absGap / alcVal) * 100;
            const dre = (colVal - alcVal) / alcVal;
            
            gapEl.textContent = formatNumber(absGap);
            if (gapTitle) gapTitle.textContent = 'Brecha de Valor';
            if (gapIcon) gapIcon.className = 'fa-solid fa-scale-unbalanced';
            const dir = absGap >= 0 ? 'up' : 'down';
            const relation = absGap >= 0 ? 'mayor que' : 'menor que';
            gapPctEl.className = `kpi-trend ${dir}`;
            gapPctEl.innerHTML = `
                <i class="fa-solid ${absGap >= 0 ? 'fa-plus' : 'fa-minus'}"></i>
                <span>${formatNumber(Math.abs(pctGap))}% ${relation} promedio ALC (${latestYearBoth})<br>
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
                    label: 'América Latina y el Caribe',
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

// 8. Update Comparative Table
function updateTable(years, colData, alcData) {
    const tbody = document.getElementById('data-table-body');
    tbody.innerHTML = '';
    
    // Render years in reverse order (newest first)
    const reversedYears = [...years].reverse();
    
    reversedYears.forEach(yr => {
        const colVal = colData[yr];
        const alcVal = alcData[yr];
        const yrInt = parseInt(yr);
        const isProj = yrInt >= 2025;
        
        let gapStr = '-';
        let pctStr = '-';
        
        if (colVal !== undefined && alcVal !== undefined) {
            const gap = colVal - alcVal;
            const pct = (gap / alcVal) * 100;
            gapStr = formatNumber(gap);
            pctStr = `${gap >= 0 ? '+' : ''}${formatNumber(pct)}%`;
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
            <td class="col-colombia colombia-cell">${colVal !== undefined ? formatNumber(colVal) : '-'}</td>
            <td class="col-alc alc-cell">${alcVal !== undefined ? formatNumber(alcVal) : '-'}</td>
            <td class="col-gap">${gapStr}</td>
            <td class="col-pct">${pctStr}</td>
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
    const container = document.getElementById('diagnostic-content');
    const metadata = (appState.indicatorData && appState.indicatorData.metadata) ? appState.indicatorData.metadata : {};
    const htmlContent = generateDiagnosticHtmlText(years, colData, alcData, metadata);
    container.innerHTML = htmlContent;
}

function generateDiagnosticHtmlText(years, colData, alcData, metadata) {
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
        
        introReal += `Por su parte, el agregado de América Latina y el Caribe (ALC) evolucionó a un ritmo del <strong>${formatNumber(alcCagrReal)}%</strong> anual.</p>`;
        
        const relationReal = colEndReal >= alcEndReal ? 'por encima de' : 'por debajo de';
        let gapRealText = `<p style="margin-top: 0.5rem;">Al cierre del registro real en <strong>${endReal}</strong>, Colombia se ubicaba <strong>${formatNumber(Math.abs(endGapReal))} unidades</strong> (${relationReal}) del promedio de ALC (diferencia del <strong>${formatNumber(Math.abs(endGapPctReal))}%</strong>). `;
        
        if (gapClosingReal) {
            gapRealText += `Esto evidencia un proceso histórico de <strong>convergencia</strong>, reduciendo la brecha inicial del <strong>${formatNumber(Math.abs(startGapPctReal))}%</strong> registrada en <strong>${startReal}</strong>.</p>`;
        } else {
            gapRealText += `Esto indica una <strong>divergencia estructural</strong> respecto al promedio regional, ampliando la brecha relativa inicial del <strong>${formatNumber(Math.abs(startGapPctReal))}%</strong> observada en <strong>${startReal}</strong>.</p>`;
        }
        
        const relationPeakReal = maxGapDirectionReal >= 0 ? 'superior' : 'inferior';
        let bulletReal = `<ul class="diagnostic-list" style="margin-top: 0.5rem; margin-bottom: 1rem;">`;
        bulletReal += `<li><strong>Brecha Histórica Máxima:</strong> Ocurrió en el año <strong>${maxGapYearReal}</strong>, donde el dato de Colombia estuvo <strong>${formatNumber(maxAbsGapReal)} unidades</strong> (${relationPeakReal}) respecto a la media de ALC.</li>`;
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
                    <li>📊 <strong>Dinámica Relativa:</strong> Colombia ha evolucionado a un ritmo <strong>${comparisonText}</strong> que el promedio de América Latina y el Caribe (CAGR de <strong>${formatNumber(colCagrReal)}%</strong> vs. <strong>${formatNumber(alcCagrReal)}%</strong>).</li>
                </ul>
            </div>`;
        }
        
        let trendReal = `
        <div style="margin-top: 1.25rem; padding: 1.25rem; background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.2); border-radius: 8px;">
            <h4 style="color: var(--accent-green); margin-bottom: 0.75rem;"><i class="fa-solid fa-arrow-trend-up"></i> Principales Tendencias Históricas</h4>
            <ul style="margin-left: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
                <li><strong>Colombia:</strong> Presenta una tendencia de <strong>${getTrendDescription(colCagrReal)}</strong>, con una tasa promedio del <strong>${formatNumber(colCagrReal)}%</strong> anual.</li>
                <li><strong>América Latina y el Caribe:</strong> Muestra una dinámica de <strong>${getTrendDescription(alcCagrReal)}</strong>, variando al <strong>${formatNumber(alcCagrReal)}%</strong> anual en promedio.</li>
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
        introProj += `Para ALC, el comportamiento esperado se sitúa en un <strong>${formatNumber(alcCagrProj)}%</strong> anual.</p>`;
        
        const relationProj = colEndProj >= alcEndProj ? 'por encima del' : 'por debajo del';
        let gapProjText = `<p style="margin-top: 0.5rem;">En el horizonte futuro de <strong>${endProj}</strong>, los modelos matemáticos prevén que Colombia se ubique <strong>${formatNumber(Math.abs(endGapProj))} unidades</strong> (${relationProj}) promedio de ALC (brecha de <strong>${formatNumber(Math.abs(endGapPctProj))}%</strong>). `;
        
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
                <li><strong>América Latina y el Caribe:</strong> Se prevé una dinámica de <strong>${getTrendDescription(alcCagrProj)}</strong> (${formatNumber(alcCagrProj)}% anual).</li>
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
    csvContent += 'Año,Colombia,América Latina y el Caribe,Brecha Absoluta,Brecha Porcentual\n';
    
    rows.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 5) return;
        
        const year = tds[0].textContent.trim();
        // Replace thousand separators and decimal points to standard CSV format
        const col = tds[1].textContent.trim().replace(/\./g, '').replace(/,/g, '.');
        const alc = tds[2].textContent.trim().replace(/\./g, '').replace(/,/g, '.');
        const gap = tds[3].textContent.trim().replace(/\./g, '').replace(/,/g, '.');
        const pct = tds[4].textContent.trim().replace('%', '').replace(/\./g, '').replace(/,/g, '.');
        
        csvContent += `"${year}","${col}","${alc}","${gap}","${pct}"\n`;
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
function switchGlobalSection(sectionId) {
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
    
    const exportarDatosSection = document.getElementById('exportar-datos-section');
    if (exportarDatosSection) {
        exportarDatosSection.style.display = sectionId === 'exportar-datos' ? 'block' : 'none';
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
    
    // Update sidebar exportar-datos button active highlight
    const sidebarExportarBtn = document.getElementById('sidebar-exportar-datos-btn');
    if (sidebarExportarBtn) {
        sidebarExportarBtn.classList.toggle('active', sectionId === 'exportar-datos');
    }
    
    // Auto load first indicator of structures if none is loaded yet
    if (sectionId === 'structures' && !appState.pyramidData) {
        selectPyramidIndicator(appState.selectedPyramidIndicatorId);
    }
}

// 11b. Click handler for sidebar Brechas section
function selectBrechasSection() {
    switchGlobalSection('brechas');
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn') {
            el.classList.remove('active');
        }
    });
    
    renderCriticalGaps();
}

// 11c. Click handler for sidebar Metodología section
function selectMetodologiaSection() {
    switchGlobalSection('metodologia');
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-exportar-datos-btn') {
            el.classList.remove('active');
        }
    });
}

// 11d. Click handler for sidebar Tendencias section
function selectTendenciasSection() {
    switchGlobalSection('tendencias');
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-tendencias-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-exportar-datos-btn') {
            el.classList.remove('active');
        }
    });
    
    renderTendencias();
}

// 11e. Click handler for sidebar Exportar Datos section
function selectExportarDatosSection() {
    switchGlobalSection('exportar-datos');
    
    // Clear selections in the thematic tree and structures
    document.querySelectorAll('.tree-leaf').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.structures-list-item').forEach(el => {
        if (el.id !== 'sidebar-exportar-datos-btn' && el.id !== 'sidebar-brechas-btn' && el.id !== 'sidebar-metodologia-btn' && el.id !== 'sidebar-tendencias-btn') {
            el.classList.remove('active');
        }
    });
    
    initExportarDatosSection();
}

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
function selectPyramidIndicator(indicatorId) {
    appState.selectedPyramidIndicatorId = indicatorId;
    
    // Switch section if not in structures
    if (appState.currentGlobalSection !== 'structures') {
        switchGlobalSection('structures');
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
    
    // Sort benchmarks by absolute DRE descending
    const sortedBenchmarks = [...CRITICAL_BENCHMARKS].sort((a, b) => {
        const dreA = Math.abs((a.colVal - a.alcVal) / a.alcVal);
        const dreB = Math.abs((b.colVal - b.alcVal) / b.alcVal);
        return dreB - dreA;
    });
    
    tbody.innerHTML = '';
    
    sortedBenchmarks.forEach(item => {
        const dre = (item.colVal - item.alcVal) / item.alcVal;
        const absDre = Math.abs(dre);
        
        let dreSign = dre >= 0 ? '+' : '';
        
        // Decide if the gap is favorable (green) or unfavorable (red) for Colombia
        // Unemployment, Poverty, Dependency, CO2: Lower is better. So negative DRE is favorable.
        // GDP per capita: Higher is better. So positive DRE is favorable.
        let isFavorable = false;
        if (item.id === 'unemployment' || item.id === 'poverty' || item.id === 'dependency' || item.id === 'co2_emissions') {
            isFavorable = dre < 0;
        } else if (item.id === 'gdp_per_capita') {
            isFavorable = dre > 0;
        }
        
        const badgeColor = isFavorable ? 'var(--accent-green)' : 'var(--accent-red)';
        const bgOpacity = 'rgba(' + (isFavorable ? '16, 185, 129' : '239, 68, 68') + ', 0.15)';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500; text-align: left; padding: 0.75rem 1rem;">
                <span class="benchmark-link" style="color: var(--accent-blue); cursor: pointer; font-weight: 600; text-decoration: none; transition: var(--transition-smooth);" onclick="selectAndFocusIndicator(${item.indicatorId})">${item.name}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-top: 0.15rem;">Año: ${item.year} | Unidad: ${item.unit}</span>
            </td>
            <td style="text-align: right; font-weight: 600; color: var(--color-colombia); padding: 0.75rem 1rem;">${formatNumber(item.colVal)}</td>
            <td style="text-align: right; font-weight: 600; color: var(--color-alc); padding: 0.75rem 1rem;">${formatNumber(item.alcVal)}</td>
            <td style="text-align: right; font-weight: 600; padding: 0.75rem 1rem;">
                <span style="padding: 0.2rem 0.5rem; border-radius: 6px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 0.8125rem;">
                    ${dreSign}${formatNumber(dre)}
                </span>
            </td>
            <td style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.3; text-align: left; padding: 0.75rem 1rem;">
                ${item.interpretation}
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
                            <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Indicador</th>
                            <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Colombia</th>
                            <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Promedio ALC</th>
                            <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">DRE</th>
                            <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Interpretación del Desvío</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Sort benchmarks by absolute DRE
    const sortedBenchmarks = [...CRITICAL_BENCHMARKS].sort((a, b) => {
        const dreA = Math.abs((a.colVal - a.alcVal) / a.alcVal);
        const dreB = Math.abs((b.colVal - b.alcVal) / b.alcVal);
        return dreB - dreA;
    });
    
    sortedBenchmarks.forEach(item => {
        const dre = (item.colVal - item.alcVal) / item.alcVal;
        const absDre = Math.abs(dre);
        let dreSign = dre >= 0 ? '+' : '';
        let isFavorable = false;
        if (item.id === 'unemployment' || item.id === 'poverty' || item.id === 'dependency' || item.id === 'co2_emissions') {
            isFavorable = dre < 0;
        } else if (item.id === 'gdp_per_capita') {
            isFavorable = dre > 0;
        }
        
        const badgeColor = isFavorable ? '#10b981' : '#ef4444';
        const bgOpacity = 'rgba(' + (isFavorable ? '16, 185, 129' : '239, 68, 68') + ', 0.1)';
        
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem 1rem; text-align: left;">
                    <strong>${item.name}</strong>
                    <span style="font-size: 7.5pt; color: var(--text-muted); display: block; margin-top: 0.15rem;">Año: ${item.year} | Unidad: ${item.unit}</span>
                </td>
                <td class="colombia-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-colombia); font-weight: 600;">${formatNumber(item.colVal)}</td>
                <td class="alc-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-alc); font-weight: 600;">${formatNumber(item.alcVal)}</td>
                <td style="text-align: right; padding: 0.75rem 1rem; font-weight: 600;">
                    <span style="padding: 0.2rem 0.5rem; border-radius: 6px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 8.5pt; border: 1px solid ${badgeColor}33;">
                        ${dreSign}${formatNumber(dre)}
                    </span>
                </td>
                <td style="font-size: 8.5pt; color: var(--text-secondary); padding: 0.75rem 1rem; line-height: 1.3; text-align: left;">${item.interpretation}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <div style="font-size: 9.5pt; line-height: 1.6; color: var(--text-secondary); margin-top: 1.5rem; padding: 1rem; background: rgba(59, 130, 246, 0.05); border: 1px dashed rgba(59, 130, 246, 0.2); border-radius: 8px;">
                <p><strong>Nota metodológica:</strong> La Desviación Relativa Estándar (DRE) se calcula como <code>(Colombia - ALC) / ALC</code>. 
                Representa el porcentaje de desvío del desempeño de Colombia con respecto al promedio de América Latina y el Caribe (ALC). 
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
                                <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Indicador</th>
                                <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Colombia</th>
                                <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Promedio ALC</th>
                                <th style="text-align: right; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">DRE</th>
                                <th style="text-align: left; padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border-color); font-weight: 600;">Interpretación del Desvío</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        const sortedBenchmarks = [...CRITICAL_BENCHMARKS].sort((a, b) => {
            const dreA = Math.abs((a.colVal - a.alcVal) / a.alcVal);
            const dreB = Math.abs((b.colVal - b.alcVal) / b.alcVal);
            return dreB - dreA;
        });
        
        sortedBenchmarks.forEach(item => {
            const dre = (item.colVal - item.alcVal) / item.alcVal;
            let dreSign = dre >= 0 ? '+' : '';
            let isFavorable = false;
            if (item.id === 'unemployment' || item.id === 'poverty' || item.id === 'dependency' || item.id === 'co2_emissions') {
                isFavorable = dre < 0;
            } else if (item.id === 'gdp_per_capita') {
                isFavorable = dre > 0;
            }
            
            const badgeColor = isFavorable ? '#10b981' : '#ef4444';
            const bgOpacity = 'rgba(' + (isFavorable ? '16, 185, 129' : '239, 68, 68') + ', 0.1)';
            
            reportHtml += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.75rem 1rem; text-align: left;">
                        <strong>${item.name}</strong>
                        <span style="font-size: 7.5pt; color: var(--text-muted); display: block; margin-top: 0.15rem;">Año: ${item.year} | Unidad: ${item.unit}</span>
                    </td>
                    <td class="colombia-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-colombia); font-weight: 600;">${formatNumber(item.colVal)}</td>
                    <td class="alc-cell" style="text-align: right; padding: 0.75rem 1rem; color: var(--color-alc); font-weight: 600;">${formatNumber(item.alcVal)}</td>
                    <td style="text-align: right; padding: 0.75rem 1rem; font-weight: 600;">
                        <span style="padding: 0.2rem 0.5rem; border-radius: 6px; background: ${bgOpacity}; color: ${badgeColor}; font-size: 8.5pt; border: 1px solid ${badgeColor}33;">
                            ${dreSign}${formatNumber(dre)}
                        </span>
                    </td>
                    <td style="font-size: 8.5pt; color: var(--text-secondary); padding: 0.75rem 1rem; line-height: 1.3; text-align: left;">${item.interpretation}</td>
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
                        <input type="checkbox" class="xls-category-checkbox" value="${cat}" checked onchange="updateXlsSelectedCount()">
                        <span>${cat}</span>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 0.15rem 0.45rem; border-radius: 4px;">${count} ind.</span>
                </label>
            `;
            checklistContainer.appendChild(div);
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
                // Fetch data for Colombia and ALC
                const url = `${API_DATA_BASE}/${ind.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID}`;
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
    const alcData = {};
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
        }
    });
    
    const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a)); // Newest first
    if (sortedYears.length === 0) return null;
    
    // Find latest year with data for both, prioritizing years < 2025
    let sharedYear = null;
    for (const yr of sortedYears) {
        const yrNum = parseInt(yr);
        if (yrNum < 2025 && colData[yr] !== undefined && alcData[yr] !== undefined) {
            sharedYear = yr;
            break;
        }
    }
    
    if (!sharedYear) {
        // Fallback: latest year with both data
        for (const yr of sortedYears) {
            if (colData[yr] !== undefined && alcData[yr] !== undefined) {
                sharedYear = yr;
                break;
            }
        }
    }
    
    if (!sharedYear) return null;
    
    const colVal = colData[sharedYear];
    const alcVal = alcData[sharedYear];
    const gap = colVal - alcVal;
    const dre = alcVal !== 0 ? gap / alcVal : 0;
    
    return {
        code: ind.id,
        category: ind.categoryPath || 'General',
        name: ind.name,
        year: sharedYear,
        colVal: colVal,
        alcVal: alcVal,
        gap: gap,
        dre: dre
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
    
    // Hide progress, hide results
    document.getElementById('mass-progress-panel').style.display = 'none';
    document.getElementById('mass-results-card').style.display = 'none';
    
    document.getElementById('btn-mass-show').style.display = 'inline-flex';
    document.getElementById('btn-mass-excel').style.display = 'inline-flex';
    document.getElementById('btn-mass-cancel').style.display = 'none';
    
    // Group indicators by top category
    massState.flatIndicators = appState.flatIndicators || [];
    massState.categories = {};
    
    massState.flatIndicators.forEach(ind => {
        const cat = ind.topCategory || 'General';
        if (!massState.categories[cat]) {
            massState.categories[cat] = [];
        }
        massState.categories[cat].push(ind);
    });
    
    // Render checklist
    const checklistContainer = document.getElementById('mass-categories-checklist');
    if (checklistContainer) {
        checklistContainer.innerHTML = '';
        const categories = Object.keys(massState.categories).sort();
        
        if (categories.length === 0) {
            checklistContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8125rem;">Cargando listado de indicadores...</div>';
            document.getElementById('btn-mass-show').setAttribute('disabled', 'true');
            document.getElementById('btn-mass-excel').setAttribute('disabled', 'true');
            return;
        }
        
        document.getElementById('btn-mass-show').removeAttribute('disabled');
        document.getElementById('btn-mass-excel').removeAttribute('disabled');
        
        categories.forEach(cat => {
            const count = massState.categories[cat].length;
            const div = document.createElement('div');
            div.innerHTML = `
                <label class="report-checkbox-item" style="display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <input type="checkbox" class="mass-category-checkbox" value="${cat}" checked onchange="updateMassSelectedCount()">
                        <span>${cat}</span>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 0.15rem 0.45rem; border-radius: 4px;">${count} ind.</span>
                </label>
            `;
            checklistContainer.appendChild(div);
        });
    }
    
    updateMassSelectedCount();
}

function updateMassSelectedCount() {
    const checkboxes = document.querySelectorAll('.mass-category-checkbox:checked');
    let totalCount = 0;
    
    massState.selectedCategories = new Set();
    checkboxes.forEach(cb => {
        const cat = cb.value;
        massState.selectedCategories.add(cat);
        totalCount += (massState.categories[cat] ? massState.categories[cat].length : 0);
    });
    
    const countEl = document.getElementById('mass-selected-count');
    if (countEl) {
        countEl.textContent = `${totalCount} indicadores seleccionados`;
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
    document.querySelectorAll('.mass-category-checkbox').forEach(cb => {
        cb.checked = checked;
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
    
    // Gather all selected indicators
    const indicatorsToFetch = [];
    massState.flatIndicators.forEach(ind => {
        if (massState.selectedCategories.has(ind.topCategory)) {
            indicatorsToFetch.push(ind);
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
                const url = `${API_DATA_BASE}/${ind.id}/data?lang=es&members=${COLOMBIA_MEMBER_ID},${ALC_MEMBER_ID}`;
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
                    <td colspan="8" class="header-title">Listado de Indicadores Comparativos CEPAL (Exportación)</td>
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
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No se encontraron datos coincidentes para los indicadores seleccionados.</td></tr>';
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
            <td style="text-align: right; font-weight: 600; color: var(--color-alc);">${formatNumber(row.alcVal)}</td>
            <td style="text-align: right; font-weight: 500; color: ${row.gap >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${row.gap >= 0 ? '+' : ''}${formatNumber(row.gap)}</td>
            <td style="text-align: right; font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">${row.dre >= 0 ? '+' : ''}${formatNumber(row.dre)}</td>
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
    csvContent += 'Código,Clase/Ruta Temática,Indicador,Año Compartido,Valor Colombia,Valor América Latina,Brecha Absoluta,Desviación Relativa Estándar (DRE)\n';
    
    massState.results.forEach(row => {
        const cat = `"${row.category.replace(/"/g, '""')}"`;
        const name = `"${row.name.replace(/"/g, '""')}"`;
        csvContent += `${row.code},${cat},${name},${row.year},${row.colVal},${row.alcVal},${row.gap},${row.dre}\n`;
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
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

