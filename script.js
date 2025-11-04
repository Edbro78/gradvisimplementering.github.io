document.addEventListener('DOMContentLoaded', () => {
    // Get references to all HTML elements
    const mainChartCanvas = document.getElementById('mainChart');
    const volatilityChartCanvas = document.getElementById('volatilityChart');
    const stockAllocationChartCanvas = document.getElementById('stockAllocationChart');
    const returnChartCanvas = document.getElementById('returnChart');
    const investmentAmountInput = document.getElementById('investmentAmount');
    const investmentAmountValueSpan = document.getElementById('investmentAmountValue');

    const marketGrowthContainer = document.getElementById('marketGrowthBoxes');
    const volatilityContainer = document.getElementById('volatilityBoxes');
    const bankRateContainer = document.getElementById('bankRateBoxes');
    const stockAllocationContainer = document.getElementById('stockAllocationInput');
    const frequencyContainer = document.getElementById('frequencyBoxes');
    const chartContainer = document.querySelector('.chart-container');
    const disclaimerBtn = document.getElementById('disclaimerBtn');
    const disclaimerModal = document.getElementById('disclaimerModal');
    const closeDisclaimerBtn = document.getElementById('closeDisclaimer');
    const outputBtn = document.getElementById('outputBtn');
    const outputModal = document.getElementById('outputModal');
    const closeOutputBtn = document.getElementById('closeOutput');
    const outputTextarea = document.getElementById('outputTextarea');
    const copyOutputBtn = document.getElementById('copyOutputBtn');
    const themeToggleBtn = document.getElementById('themeToggle');

    // Theme handling
    const rootEl = document.documentElement;
    function setTheme(mode) {
        if (mode === 'dark') {
            rootEl.classList.add('dark');
        } else {
            rootEl.classList.remove('dark');
        }
        try { localStorage.setItem('theme', mode); } catch (_) {}
        if (themeToggleBtn) {
            if (mode === 'dark') {
                themeToggleBtn.setAttribute('aria-label', 'Bytt til lyst tema');
                themeToggleBtn.title = 'Lyst tema';
                themeToggleBtn.textContent = '☀️';
            } else {
                themeToggleBtn.setAttribute('aria-label', 'Bytt til mørkt tema');
                themeToggleBtn.title = 'Mørkt tema';
                themeToggleBtn.textContent = '🌓';
            }
        }
    }

    (function initTheme() {
        let saved = null;
        try { saved = localStorage.getItem('theme'); } catch (_) {}
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const mode = saved ? saved : (prefersDark ? 'dark' : 'light');
        setTheme(mode);
    })();

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            setTheme(isDark ? 'light' : 'dark');
            // Refresh charts to pick up updated CSS variables
            updateDashboard();
        });
    }

    // Chart.js dataset shadow plugin for light mode
    const datasetShadowPlugin = {
        id: 'datasetShadow',
        beforeDatasetsDraw(chart) {
            const isDark = document.documentElement.classList.contains('dark');
            chart.$shadowApplied = !isDark;
            if (!isDark) {
                const ctx = chart.ctx;
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
                ctx.shadowBlur = 14;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 6;
            }
        },
        afterDatasetsDraw(chart) {
            if (chart.$shadowApplied) {
                chart.ctx.restore();
                chart.$shadowApplied = false;
            }
        }
    };
    if (window.Chart && Chart.register) {
        Chart.register(datasetShadowPlugin);
    }
    
    let mainChart;
    let volatilityChart;
    let stockAllocationChart;
    let returnChart;
    // Fullskjerm håndteres per grafikk-kort via klassen 'fullscreen'
    const investmentPeriod = 1; // Investeringsperioden er nå fastsatt til 1 år
    
    // Format number with thousand separators
    function formatNumber(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    // Norwegian number/currency formatters
    const nf = new Intl.NumberFormat('no-NO');
    const cf0 = new Intl.NumberFormat('no-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
    const pf2 = new Intl.NumberFormat('no-NO', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

    // Function to simulate market data
    function simulateMarketData(marketGrowth, volatility, days) {
        const initialMarketIndex = 10000;
        const finalGrowthFactor = 1 + (marketGrowth / 100);
        const marketData = [];

        // 1. Generate an exponential growth curve that hits the exact end value
        const growthRatePerDay = Math.pow(finalGrowthFactor, 1 / days);
        
        // 2. Generate a random "noise" curve that starts and ends at 0
        let randomWalk = [0];
        let sum = 0;
        const dailyVolatilityFactor = volatility / 100 / Math.sqrt(365);
        for (let i = 1; i < days; i++) {
            sum += (Math.random() * 2 - 1) * dailyVolatilityFactor;
            randomWalk.push(sum);
        }
        const noiseCorrection = -randomWalk[days - 1] / days;
        const finalNoiseArray = randomWalk.map((v, i) => v + noiseCorrection * i);
        
        // 3. Combine the smooth growth curve with the corrected noise
        for (let i = 0; i < days; i++) {
            const baseValue = initialMarketIndex * Math.pow(growthRatePerDay, i);
            const volatileValue = baseValue * (1 + finalNoiseArray[i]);
            marketData.push(volatileValue);
        }

        return marketData;
    }

    // Function to calculate the value of a lump sum investment on day 1
    function calculateLumpSum(initialAmount, marketData, bankRate, targetStockAllocation) {
        const lumpSumValues = [];
        const initialMarketIndex = marketData[0];
        const stockAllocation = targetStockAllocation / 100;
        const bondAllocation = 1 - stockAllocation;
        
        // Calculate daily bank rate factor
        const dailyBankRateFactor = Math.pow(1 + bankRate / 100, 1 / 365);
        
        for (let i = 0; i < marketData.length; i++) {
            // Calculate stock portion value
            const stockValue = initialAmount * stockAllocation * (marketData[i] / initialMarketIndex);
            
            // Calculate bond portion value with daily compounding
            const bondValue = initialAmount * bondAllocation * Math.pow(dailyBankRateFactor, i);
            
            const currentValue = stockValue + bondValue;
            lumpSumValues.push(currentValue);
        }
        return lumpSumValues;
    }

    // Function to calculate the periodic strategy and the stock portion
    function calculatePeriodic(initialAmount, marketData, frequency, bankRate, targetStockAllocation) {
        const days = marketData.length;
        let numberOfIntervals;
        switch (frequency) {
            case 'daily': numberOfIntervals = 365; break;
            case 'weekly': numberOfIntervals = 52; break;
            case 'monthly': numberOfIntervals = 12; break;
            case 'quarterly': numberOfIntervals = 4; break;
            case 'half-yearly': numberOfIntervals = 2; break;
            case 'yearly': numberOfIntervals = 1; break;
            default: numberOfIntervals = 4;
        }
        
        const totalStockInvestmentAmount = initialAmount * (targetStockAllocation / 100);
        const periodicStockInvestment = totalStockInvestmentAmount / numberOfIntervals;
        const daysPerInterval = Math.round(days / numberOfIntervals);
        
        // Correct calculation for daily compounding bank rate
        const dailyBankRateFactor = Math.pow(1 + bankRate / 100, 1 / days);
        
        const totalValues = [];
        let portfolioStockValue = 0; 
        let portfolioCashValue = initialAmount;
        let investmentDay = 0;
        
        for (let i = 0; i < days; i++) {
            if (i === investmentDay && investmentDay < days) {
                 portfolioCashValue -= periodicStockInvestment;
                 portfolioStockValue += periodicStockInvestment;
                 investmentDay += daysPerInterval;
            }
            
            if (i > 0) {
                const dailyReturn = marketData[i] / marketData[i - 1];
                portfolioStockValue *= dailyReturn;
            }
            
            portfolioCashValue *= dailyBankRateFactor;

            totalValues.push(portfolioStockValue + portfolioCashValue);
        }
        return { totalValues };
    }

    // New function to calculate monthly volatility
    function calculateMonthlyVolatility(marketData) {
        const monthlyVolatility = [];
        const monthlyVolatilityLevels = [];
        const monthlyVolatilityLevelNames = [];
        const dailyReturns = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
        const daysInYear = 365;

        // Map a volatility percentage to level (1-7) and label per user spec
        function mapVolatilityToLevel(pct) {
            if (pct < 1) return { level: 1, name: 'Ingen/Ekstremt Lav' };
            if (pct < 2.5) return { level: 2, name: 'Veldig Lav' };
            if (pct < 3.5) return { level: 3, name: 'Lav/Gjennomsnittlig Langsiktig' };
            if (pct < 5.0) return { level: 4, name: 'Moderat/Historisk Gjennomsnittlig' };
            if (pct < 7.5) return { level: 5, name: 'Høy' };
            if (pct < 12.0) return { level: 6, name: 'Veldig Høy' };
            return { level: 7, name: 'Ekstremt Høy' };
        }

        for (let i = 1; i < daysInYear; i++) {
            dailyReturns.push((marketData[i] - marketData[i-1]) / marketData[i-1]);
        }
        
        const daysInMonth = daysInYear / 12;
        
        for(let i = 0; i < 12; i++) {
            const startDay = Math.round(i * daysInMonth);
            const endDay = Math.round((i + 1) * daysInMonth);
            const monthReturns = dailyReturns.slice(startDay, endDay);
            
            if (monthReturns.length > 0) {
                const mean = monthReturns.reduce((acc, val) => acc + val, 0) / monthReturns.length;
                const variance = monthReturns.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / monthReturns.length;
                // Monthly volatility (NOT annualized): daily std * sqrt(days in month)
                const stdDevDaily = Math.sqrt(variance);
                const stdDevMonthly = stdDevDaily * Math.sqrt(monthReturns.length);
                const pct = stdDevMonthly * 100;
                const pctStr = pct.toFixed(2);
                monthlyVolatility.push(pctStr);
                const mapped = mapVolatilityToLevel(pct);
                monthlyVolatilityLevels.push(mapped.level);
                monthlyVolatilityLevelNames.push(mapped.name);
            } else {
                monthlyVolatility.push(0);
                monthlyVolatilityLevels.push(1);
                monthlyVolatilityLevelNames.push('Ingen/Ekstremt Lav');
            }
        }
        return {monthlyVolatility, monthlyVolatilityLevels, monthlyVolatilityLevelNames, months};
    }

    // Compute monthly market returns directly from market index data
    function calculateMonthlyMarketReturns(marketData) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
        const days = marketData.length; // typically 365
        const boundary = (k) => Math.round((k * days) / 12);
        const monthlyReturns = [];
        for (let i = 0; i < 12; i++) {
            const startIdx = boundary(i);
            const endIdx = Math.min(boundary(i + 1) - 1, days - 1);
            const startVal = marketData[startIdx] ?? marketData[0];
            const endVal = marketData[endIdx] ?? marketData[days - 1];
            const r = startVal !== 0 ? ((endVal / startVal) - 1) * 100 : 0;
            monthlyReturns.push(parseFloat(r.toFixed(2)));
        }
        return { monthlyReturns, months };
    }

    // Corrected function to calculate monthly stock allocation
    function calculateMonthlyAllocation(initialAmount, frequency, targetStockAllocation) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthlyAllocation = Array(12).fill(0);
        const totalInvestment = initialAmount * (targetStockAllocation / 100);

        if (totalInvestment === 0) {
            return {monthlyAllocation, months};
        }

        let numInvestments;
        switch (frequency) {
            case 'daily': numInvestments = 365; break;
            case 'weekly': numInvestments = 52; break;
            case 'monthly': numInvestments = 12; break;
            case 'quarterly': numInvestments = 4; break;
            case 'half-yearly': numInvestments = 2; break;
            case 'yearly': numInvestments = 1; break;
            default: numInvestments = 4;
        }

        const investmentPerInterval = totalInvestment / numInvestments;
        let cumulativeInvested = 0;

        const investmentsPerMonth = {
            'daily': Math.round(365 / 12),
            'weekly': Math.round(52 / 12),
            'monthly': 1,
            'quarterly': 1,
            'half-yearly': 1,
            'yearly': 1
        };

        for(let i = 0; i < 12; i++) {
            let monthlyInvestments = 0;
            if (frequency === 'daily') {
                monthlyInvestments = investmentsPerMonth.daily;
            } else if (frequency === 'weekly') {
                monthlyInvestments = investmentsPerMonth.weekly;
            } else if (frequency === 'monthly') {
                monthlyInvestments = 1;
            } else if (frequency === 'quarterly' && i % 3 === 0) {
                monthlyInvestments = 1;
            } else if (frequency === 'half-yearly' && i % 6 === 0) {
                monthlyInvestments = 1;
            } else if (frequency === 'yearly' && i === 0) {
                monthlyInvestments = 1;
            }
            
            cumulativeInvested += monthlyInvestments * (totalInvestment / numInvestments);
            const allocationPercentage = (cumulativeInvested / initialAmount) * 100;
            monthlyAllocation[i] = Math.min(allocationPercentage, targetStockAllocation).toFixed(2);
        }

        return {monthlyAllocation, months};
    }
    
    // New function to calculate monthly returns and moving average
    function calculateMonthlyReturns(lumpSumData, periodicData) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
        const daysInMonth = Math.round(365 / 12);
        
        const lumpSumReturns = [];
        const periodicReturns = [];

        for (let i = 0; i < 12; i++) {
            const startDay = i * daysInMonth;
            const endDay = (i + 1) * daysInMonth;
            
            const lumpSumStartValue = lumpSumData[startDay] || 0;
            const lumpSumEndValue = lumpSumData[endDay - 1] || lumpSumData[lumpSumData.length - 1];

            const periodicStartValue = periodicData[startDay] || 0;
            const periodicEndValue = periodicData[endDay - 1] || periodicData[periodicData.length - 1];

            const lumpSumReturn = (lumpSumStartValue !== 0) ? ((lumpSumEndValue / lumpSumStartValue) - 1) * 100 : 0;
            const periodicReturn = (periodicStartValue !== 0) ? ((periodicEndValue / periodicStartValue) - 1) * 100 : 0;
            
            lumpSumReturns.push(lumpSumReturn.toFixed(2));
            periodicReturns.push(periodicReturn.toFixed(2));
        }
        
        // Calculate 3-month moving average for periodic returns
        const movingAverage = [];
        for (let i = 0; i < 12; i++) {
            let sum = 0;
            let count = 0;
            for (let j = 0; j < 3; j++) {
                if (i - j >= 0) {
                    sum += parseFloat(periodicReturns[i - j]);
                    count++;
                }
            }
            movingAverage.push((sum / count).toFixed(2));
        }

        return { lumpSumReturns, periodicReturns, movingAverage, months };
    }

    // Function to toggle fullscreen mode
    function toggleFullscreen(event) {
        const button = event.currentTarget;
        const chartCard = button.closest('.chart-card');
        if (!chartCard) return;

        const entering = !chartCard.classList.contains('fullscreen');
        if (entering) {
            chartCard.classList.add('fullscreen');
            button.title = 'Avslutt fullskjerm';
        } else {
            chartCard.classList.remove('fullscreen');
            button.title = 'Fullskjerm';
        }

        // Hide/show siblings when entering/exiting fullscreen
        const container = chartCard.parentElement;
        Array.from(container.children).forEach(child => {
            if (child !== chartCard) {
                child.style.display = entering ? 'none' : 'block';
            }
        });

        // Resize charts after transition
        setTimeout(() => {
            if (mainChart) mainChart.resize();
            if (volatilityChart) volatilityChart.resize();
            if (stockAllocationChart) stockAllocationChart.resize();
            if (returnChart) returnChart.resize();
        }, 300);
    }

    // Function to show disclaimer modal
    function showDisclaimer() {
        disclaimerModal.style.display = 'flex';
    }

    // Function to hide disclaimer modal
    function hideDisclaimer() {
        disclaimerModal.style.display = 'none';
    }

    // Output modal controls
    function showOutput() {
        // Refresh text every time user opens
        outputTextarea.value = generateOutputText();
        outputModal.style.display = 'flex';
        // Reset copy button visual state
        copyOutputBtn.classList.remove('copied');
        const label = copyOutputBtn.querySelector('.copy-label');
        const icon = copyOutputBtn.querySelector('.copy-icon');
        if (label) label.textContent = 'Kopier';
        if (icon) icon.textContent = '📋';
        // Focus textarea for quick selection
        outputTextarea.focus();
    }

    function hideOutput() {
        outputModal.style.display = 'none';
    }

    // Function to get the value of the active box in a container
    function getActiveBoxValue(container) {
        const activeBox = container.querySelector('.box-option.active');
        return activeBox ? parseFloat(activeBox.getAttribute('data-value')) || activeBox.getAttribute('data-value') : null;
    }
    
    // Function to handle box clicks
    function handleBoxClick(event) {
        const clickedBox = event.target.closest('.box-option');
        if (!clickedBox) return;

        const container = event.currentTarget;
        container.querySelectorAll('.box-option').forEach(box => {
            box.classList.remove('active');
        });
        clickedBox.classList.add('active');
        updateDashboard();
    }
    
    // Event listener for the new range input
    investmentAmountInput.addEventListener('input', () => {
        const value = parseInt(investmentAmountInput.value);
        investmentAmountValueSpan.textContent = formatNumber(value);
        updateDashboard();
    });

    // Keep last computed snapshot for output generation
    let lastSnapshot = null;

    // Main function to update the dashboard
    function updateDashboard() {
        const investmentAmount = parseFloat(investmentAmountInput.value); 
        const marketGrowth = getActiveBoxValue(marketGrowthContainer);
        const volatility = getActiveBoxValue(volatilityContainer);
        const bankRate = getActiveBoxValue(bankRateContainer);
        const stockAllocation = getActiveBoxValue(stockAllocationContainer);
        const frequency = getActiveBoxValue(frequencyContainer);
        const days = investmentPeriod * 365;

        const marketData = simulateMarketData(marketGrowth, volatility, days);
        
        const fullLumpSumValues = calculateLumpSum(investmentAmount, marketData, bankRate, stockAllocation);
        const { totalValues } = calculatePeriodic(investmentAmount, marketData, frequency, bankRate, stockAllocation);
        
        const { monthlyVolatility, monthlyVolatilityLevels, monthlyVolatilityLevelNames, months } = calculateMonthlyVolatility(marketData);
        const { monthlyAllocation } = calculateMonthlyAllocation(investmentAmount, frequency, stockAllocation);
        const { monthlyReturns: marketMonthlyReturns } = calculateMonthlyMarketReturns(marketData);
        const { lumpSumReturns, periodicReturns } = calculateMonthlyReturns(fullLumpSumValues, totalValues);
        
        // Build 12-point monthly value series from monthly returns so charts align
        function buildMonthlySeries(startValue, monthlyReturnsArray) {
            let value = startValue;
            const series = [];
            for (let i = 0; i < 12; i++) {
                const r = parseFloat(monthlyReturnsArray[i] ?? 0);
                value = value * (1 + (isNaN(r) ? 0 : r / 100));
                series.push(value);
            }
            return series;
        }

        const monthlyValuesLump = buildMonthlySeries(investmentAmount, marketMonthlyReturns);
        let monthlyValuesPeriodic = buildMonthlySeries(investmentAmount, periodicReturns);
        if (frequency === 'yearly') {
            // With yearly frequency, both strategies are identical (single investment at start)
            monthlyValuesPeriodic = monthlyValuesLump.slice();
        }

        const labels = months; // show month names on the main chart
        const finalLumpSum = monthlyValuesLump[monthlyValuesLump.length - 1];
        const finalPeriodic = monthlyValuesPeriodic[monthlyValuesPeriodic.length - 1];

        // Snapshot for output
        lastSnapshot = {
            inputs: {
                investmentAmount,
                marketGrowth,
                volatility,
                bankRate,
                stockAllocation,
                frequency
            },
            results: {
                finalLumpSum,
                finalPeriodic,
                monthlyVolatility,
                monthlyAllocation,
                lumpSumReturns,
                periodicReturns
            }
        };
        
        const rootStyles = getComputedStyle(document.documentElement);
        const accentBlue = rootStyles.getPropertyValue('--accent-blue').trim();
        const accentGreen = rootStyles.getPropertyValue('--accent-green').trim();
        const isDark = document.documentElement.classList.contains('dark');
        const chartTextColor = isDark ? rootStyles.getPropertyValue('--text-dark').trim() : '#000000';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.12)';
        const chartBarGray = rootStyles.getPropertyValue('--chart-bar-gray').trim();
        const chartBarLightBlue = rootStyles.getPropertyValue('--chart-bar-light-blue').trim();
        const accentRed = rootStyles.getPropertyValue('--accent-red').trim();


        if (mainChart) {
            mainChart.data.labels = labels;
            mainChart.data.datasets[0].data = monthlyValuesLump; 
            mainChart.data.datasets[0].label = `Engangsinnskudd dag 1 (${stockAllocation}% aksjer)`;
            mainChart.data.datasets[1].data = monthlyValuesPeriodic;
            mainChart.data.datasets[1].label = `Portefølje med gradvis implementering (${stockAllocation}% aksjer)`;
            const minMain = Math.min(...monthlyValuesLump, ...monthlyValuesPeriodic);
            const maxMain = Math.max(...monthlyValuesLump, ...monthlyValuesPeriodic);
            mainChart.options.scales.y.min = Math.floor(minMain / 1000000) * 1000000;
            mainChart.options.scales.y.max = Math.ceil(maxMain / 1000000) * 1000000;
            // Ensure colors are correct for current theme
            mainChart.options.scales.x.grid.color = gridColor;
            mainChart.options.scales.y.grid.color = gridColor;
            mainChart.options.scales.x.ticks.color = chartTextColor;
            mainChart.options.scales.y.ticks.color = chartTextColor;
            if (mainChart.options.plugins && mainChart.options.plugins.legend && mainChart.options.plugins.legend.labels) {
                mainChart.options.plugins.legend.labels.color = chartTextColor;
            }
            if (mainChart.options.plugins && mainChart.options.plugins.tooltip) {
                mainChart.options.plugins.tooltip.titleColor = chartTextColor;
                mainChart.options.plugins.tooltip.bodyColor = chartTextColor;
            }
            mainChart.update();
        } else {
            const ctx = mainChartCanvas.getContext('2d');
            const minMain = Math.min(...monthlyValuesLump, ...monthlyValuesPeriodic);
            const maxMain = Math.max(...monthlyValuesLump, ...monthlyValuesPeriodic);
            mainChart = new Chart(ctx, {
                type: 'line', 
                data: {
                    labels: labels,
                    datasets: [{
                        label: `Engangsinnskudd dag 1 (${stockAllocation}% aksjer)`, 
                        data: monthlyValuesLump,
                        borderColor: accentBlue,
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'y'
                    }, {
                        label: `Portefølje med gradvis implementering (${stockAllocation}% aksjer)`,
                        data: monthlyValuesPeriodic,
                        borderColor: accentGreen,
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'y'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { 
                            display: true,
                            grid: { color: gridColor },
                            ticks: { color: chartTextColor }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Verdi (kr)', color: chartTextColor },
                            grid: { color: gridColor },
                            ticks: { color: chartTextColor, callback: function(value) { return value/1000000 + ' M'; } },
                            min: Math.floor(minMain / 1000000) * 1000000,
                            max: Math.ceil(maxMain / 1000000) * 1000000
                        }
                    },
                    plugins: {
                        legend: { 
                            position: 'bottom',
                            align: 'center',
                            labels: { 
                                color: chartTextColor,
                                usePointStyle: true,
                                pointStyle: 'line',
                                padding: 20
                            }
                        },
                        tooltip: { 
                            mode: 'index',
                            intersect: false,
                            titleColor: chartTextColor,
                            bodyColor: chartTextColor,
                            callbacks: {
                                title: (tooltipItems) => tooltipItems[0].label,
                                label: (context) => {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += new Intl.NumberFormat('no-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        if (volatilityChart) {
            volatilityChart.data.labels = months;
            volatilityChart.data.datasets[0].data = monthlyVolatility;
            volatilityChart.data.datasets[0].volLevelNames = monthlyVolatilityLevelNames;
            volatilityChart.data.datasets[0].volLevels = monthlyVolatilityLevels;
            const minVol = Math.min(...monthlyVolatility.map(v => parseFloat(v)));
            const maxVol = Math.max(...monthlyVolatility.map(v => parseFloat(v)));
            volatilityChart.options.scales.y.min = Math.floor(minVol) - 1;
            volatilityChart.options.scales.y.max = Math.ceil(maxVol) + 1;
            volatilityChart.options.scales.x.grid.color = gridColor;
            volatilityChart.options.scales.y.grid.color = gridColor;
            volatilityChart.options.scales.x.ticks.color = chartTextColor;
            volatilityChart.options.scales.y.ticks.color = chartTextColor;
            if (volatilityChart.options.plugins && volatilityChart.options.plugins.tooltip) {
                volatilityChart.options.plugins.tooltip.titleColor = chartTextColor;
                volatilityChart.options.plugins.tooltip.bodyColor = chartTextColor;
            }
            volatilityChart.update();
        } else {
            const ctx = volatilityChartCanvas.getContext('2d');
            const minVol = Math.min(...monthlyVolatility.map(v => parseFloat(v)));
            const maxVol = Math.max(...monthlyVolatility.map(v => parseFloat(v)));
            volatilityChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Volatilitet (%)',
                        data: monthlyVolatility,
                        backgroundColor: chartBarGray,
                        borderWidth: 1,
                        volLevelNames: monthlyVolatilityLevelNames,
                        volLevels: monthlyVolatilityLevels,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: chartTextColor }
                        },
                        y: {
                            title: { display: true, text: 'Volatilitet (%)', color: chartTextColor },
                            grid: { color: gridColor },
                            ticks: { color: chartTextColor },
                            min: Math.floor(minVol) - 1,
                            max: Math.ceil(maxVol) + 1
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            titleColor: chartTextColor,
                            bodyColor: chartTextColor,
                            callbacks: {
                                title: (tooltipItems) => {
                                    return tooltipItems[0].label;
                                },
                                label: (context) => {
                                    const pct = context.parsed.y;
                                    const levelName = context.dataset.volLevelNames ? context.dataset.volLevelNames[context.dataIndex] : '';
                                    const levelNum = context.dataset.volLevels ? context.dataset.volLevels[context.dataIndex] : '';
                                    return `Volatilitet: ${pct}%  •  Nivå ${levelNum}: ${levelName}`;
                                },
                            }
                        }
                    }
                }
            });
        }

        if (stockAllocationChart) {
            stockAllocationChart.data.labels = months;
            stockAllocationChart.data.datasets[0].data = monthlyAllocation;
            stockAllocationChart.options.scales.x.grid.color = gridColor;
            stockAllocationChart.options.scales.y.grid.color = gridColor;
            stockAllocationChart.options.scales.x.ticks.color = chartTextColor;
            stockAllocationChart.options.scales.y.ticks.color = chartTextColor;
            if (stockAllocationChart.options.plugins && stockAllocationChart.options.plugins.tooltip) {
                stockAllocationChart.options.plugins.tooltip.titleColor = chartTextColor;
                stockAllocationChart.options.plugins.tooltip.bodyColor = chartTextColor;
            }
            stockAllocationChart.update();
        } else {
            const ctx = stockAllocationChartCanvas.getContext('2d');
            stockAllocationChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Aksjeandel (%)',
                        data: monthlyAllocation,
                        backgroundColor: chartBarLightBlue,
                        borderWidth: 1,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: chartTextColor }
                        },
                        y: {
                            title: { display: true, text: 'Aksjeandel (%)', color: chartTextColor },
                            grid: { color: gridColor },
                            ticks: { 
                                color: chartTextColor,
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            min: 0,
                            max: 100
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            titleColor: chartTextColor,
                            bodyColor: chartTextColor,
                            callbacks: {
                                title: (tooltipItems) => {
                                    return tooltipItems[0].label;
                                },
                                label: (context) => {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += `${context.parsed.y}%`;
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // New return chart
        if (returnChart) {
            returnChart.data.labels = months;
            returnChart.data.datasets[0].data = marketMonthlyReturns;
            returnChart.data.datasets[0].label = 'Månedlig avkastning (marked)';
            returnChart.data.datasets[0].backgroundColor = marketMonthlyReturns.map(value => value >= 0 ? accentGreen : accentRed);
            const minReturn = Math.min(...marketMonthlyReturns.map(v => parseFloat(v)));
            const maxReturn = Math.max(...marketMonthlyReturns.map(v => parseFloat(v)));
            returnChart.options.scales.y.min = Math.floor(minReturn) - 1;
            returnChart.options.scales.y.max = Math.ceil(maxReturn) + 1;
            returnChart.options.scales.x.grid.color = gridColor;
            returnChart.options.scales.y.grid.color = gridColor;
            returnChart.options.scales.x.ticks.color = chartTextColor;
            returnChart.options.scales.y.ticks.color = chartTextColor;
            if (returnChart.options.plugins && returnChart.options.plugins.tooltip) {
                returnChart.options.plugins.tooltip.titleColor = chartTextColor;
                returnChart.options.plugins.tooltip.bodyColor = chartTextColor;
            }
            returnChart.update();
        } else {
             const ctx = returnChartCanvas.getContext('2d');
             const minReturn = Math.min(...marketMonthlyReturns.map(v => parseFloat(v)));
             const maxReturn = Math.max(...marketMonthlyReturns.map(v => parseFloat(v)));

             returnChart = new Chart(ctx, {
                 type: 'bar',
                 data: {
                     labels: months,
                     datasets: [{
                         label: 'Månedlig avkastning (marked)',
                         data: marketMonthlyReturns,
                         backgroundColor: marketMonthlyReturns.map(value => value >= 0 ? accentGreen : accentRed),
                     }]
                 },
                 options: {
                     responsive: true,
                     maintainAspectRatio: false,
                     scales: {
                         x: {
                             grid: { color: gridColor },
                             ticks: { color: chartTextColor }
                         },
                         y: {
                             title: { display: true, text: 'Avkastning (%)', color: chartTextColor },
                             grid: { color: gridColor },
                             ticks: { 
                                color: chartTextColor,
                                callback: function(value) {
                                    return value + '%';
                                }
                             },
                             min: Math.floor(minReturn) - 1,
                             max: Math.ceil(maxReturn) + 1
                         }
                     },
                     plugins: {
                         legend: { display: false },
                         tooltip: {
                             mode: 'index',
                             intersect: false,
                             titleColor: chartTextColor,
                             bodyColor: chartTextColor,
                             callbacks: {
                                 title: (tooltipItems) => {
                                     return tooltipItems[0].label;
                                 },
                                 label: (context) => {
                                     let label = context.dataset.label || '';
                                     if (label) {
                                         label += ': ';
                                     }
                                     if (context.parsed.y !== null) {
                                         label += `${context.parsed.y}%`;
                                     }
                                     return label;
                                 }
                             }
                         }
                     }
                 }
             });
        }


        
    }

    // Build output text in Norwegian with sections
    function generateOutputText() {
        try {
            if (!lastSnapshot) {
                updateDashboard();
            }
            const s = lastSnapshot;
            if (!s) return 'Ingen data tilgjengelig.';

            const freqLabelMap = {
                'daily': 'Daglig',
                'weekly': 'Ukentlig',
                'monthly': 'Månedlig',
                'quarterly': 'Kvartalsvis',
                'half-yearly': 'Halvårlig',
                'yearly': 'Årlig'
            };

            const header = '— Output (sanntidsdata) —';

            const inputs = [
                `Total investering: ${cf0.format(s.inputs.investmentAmount)}`,
                `Markedsutvikling: ${pf2.format(s.inputs.marketGrowth)}%`,
                `Volatilitet: ${pf2.format(s.inputs.volatility)}%`,
                `Bankrente (ventende kapital): ${pf2.format(s.inputs.bankRate)}%`,
                `Aksjeandel første år: ${pf2.format(s.inputs.stockAllocation)}%`,
                `Investeringsfrekvens: ${freqLabelMap[s.inputs.frequency] || s.inputs.frequency}`
            ].join('\n');

            const results = [
                `Sluttverdi engangsinnskudd dag 1: ${cf0.format(s.results.finalLumpSum)}`,
                `Sluttverdi gradvis implementering: ${cf0.format(s.results.finalPeriodic)}`
            ].join('\n');

            return [
                header,
                '',
                '[Inndata]',
                inputs,
                '',
                '[Resultater]',
                results
            ].join('\n');
        } catch (err) {
            return 'Kunne ikke generere output.';
        }
    }

    // Copy to clipboard with fallback and temporary success state
    let copyResetTimer = null;
    async function copyOutput() {
        const text = outputTextarea.value;
        if (!text) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback
                const temp = document.createElement('textarea');
                temp.value = text;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
            }
            // Success UI
            copyOutputBtn.classList.add('copied');
            const label = copyOutputBtn.querySelector('.copy-label');
            const icon = copyOutputBtn.querySelector('.copy-icon');
            if (label) label.textContent = 'Kopiert!';
            if (icon) icon.textContent = '✔';
            if (copyResetTimer) clearTimeout(copyResetTimer);
            copyResetTimer = setTimeout(() => {
                copyOutputBtn.classList.remove('copied');
                if (label) label.textContent = 'Kopier';
                if (icon) icon.textContent = '📋';
            }, 2000);
        } catch (e) {
            alert('Kopiering feilet. Marker og kopier manuelt (Ctrl+C).');
        }
    }

    // Update the display value of the range input in real time
    investmentAmountInput.addEventListener('input', () => {
        const value = parseInt(investmentAmountInput.value);
        investmentAmountValueSpan.textContent = formatNumber(value);
        updateDashboard();
    });

    marketGrowthContainer.addEventListener('click', handleBoxClick);
    volatilityContainer.addEventListener('click', handleBoxClick);
    bankRateContainer.addEventListener('click', handleBoxClick);
    stockAllocationContainer.addEventListener('click', handleBoxClick);
    frequencyContainer.addEventListener('click', handleBoxClick);
    document.querySelectorAll('.fullscreen-btn').forEach(btn => btn.addEventListener('click', toggleFullscreen));
    disclaimerBtn.addEventListener('click', showDisclaimer);
    closeDisclaimerBtn.addEventListener('click', hideDisclaimer);
    outputBtn.addEventListener('click', showOutput);
    closeOutputBtn.addEventListener('click', hideOutput);
    copyOutputBtn.addEventListener('click', copyOutput);
    
    // Close modals when clicking outside of content
    disclaimerModal.addEventListener('click', (e) => {
        if (e.target === disclaimerModal) {
            hideDisclaimer();
        }
    });
    outputModal.addEventListener('click', (e) => {
        if (e.target === outputModal) {
            hideOutput();
        }
    });

    // Global Escape key to close any open modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (disclaimerModal.style.display === 'flex') hideDisclaimer();
            if (outputModal.style.display === 'flex') hideOutput();
        }
    });
    
    updateDashboard();
    
    window.addEventListener('resize', () => {
        if (mainChart) {
            mainChart.resize();
        }
        if (volatilityChart) {
            volatilityChart.resize();
        }
        if (stockAllocationChart) {
            stockAllocationChart.resize();
        }
        if (returnChart) {
            returnChart.resize();
        }
    });
});
