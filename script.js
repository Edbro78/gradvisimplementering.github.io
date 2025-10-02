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
        const dailyReturns = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
        const daysInYear = 365;

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
                const stdDev = Math.sqrt(variance) * Math.sqrt(252);
                monthlyVolatility.push((stdDev * 100).toFixed(2));
            } else {
                monthlyVolatility.push(0);
            }
        }
        return {monthlyVolatility, months};
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
        
        const { monthlyVolatility, months } = calculateMonthlyVolatility(marketData);
        const { monthlyAllocation } = calculateMonthlyAllocation(investmentAmount, frequency, stockAllocation);
        const { lumpSumReturns, periodicReturns } = calculateMonthlyReturns(fullLumpSumValues, totalValues);
        
        const labels = Array.from({ length: days }, (_, i) => `Dag ${i + 1}`);
        const finalLumpSum = fullLumpSumValues[fullLumpSumValues.length - 1];
        const finalPeriodic = totalValues[totalValues.length - 1];
        
        const rootStyles = getComputedStyle(document.documentElement);
        const accentBlue = rootStyles.getPropertyValue('--accent-blue').trim();
        const accentGreen = rootStyles.getPropertyValue('--accent-green').trim();
        const chartTextColor = rootStyles.getPropertyValue('--text-dark').trim();
        const chartBarGray = rootStyles.getPropertyValue('--chart-bar-gray').trim();
        const chartBarLightBlue = rootStyles.getPropertyValue('--chart-bar-light-blue').trim();
        const accentRed = rootStyles.getPropertyValue('--accent-red').trim();


        if (mainChart) {
            mainChart.data.labels = labels;
            mainChart.data.datasets[0].data = fullLumpSumValues; 
            mainChart.data.datasets[0].label = `Engangsinnskudd dag 1 (${stockAllocation}% aksjer)`;
            mainChart.data.datasets[1].data = totalValues;
            mainChart.data.datasets[1].label = `Portefølje med gradvis implementering (${stockAllocation}% aksjer)`;
            const minMain = Math.min(...fullLumpSumValues, ...totalValues);
            const maxMain = Math.max(...fullLumpSumValues, ...totalValues);
            mainChart.options.scales.y.min = Math.floor(minMain / 1000000) * 1000000;
            mainChart.options.scales.y.max = Math.ceil(maxMain / 1000000) * 1000000;
            mainChart.update();
        } else {
            const ctx = mainChartCanvas.getContext('2d');
            const minMain = Math.min(...fullLumpSumValues, ...totalValues);
            const maxMain = Math.max(...fullLumpSumValues, ...totalValues);
            mainChart = new Chart(ctx, {
                type: 'line', 
                data: {
                    labels: labels,
                    datasets: [{
                        label: `Engangsinnskudd dag 1 (${stockAllocation}% aksjer)`, 
                        data: fullLumpSumValues,
                        borderColor: accentBlue,
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'y'
                    }, {
                        label: `Portefølje med gradvis implementering (${stockAllocation}% aksjer)`,
                        data: totalValues,
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
                            display: false,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Verdi (kr)', color: chartTextColor },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
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
                            callbacks: {
                                title: (tooltipItems) => {
                                    const daysLabel = tooltipItems[0].label;
                                    return `Dag ${parseInt(daysLabel.split(' ')[1])}`;
                                },
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
            const minVol = Math.min(...monthlyVolatility.map(v => parseFloat(v)));
            const maxVol = Math.max(...monthlyVolatility.map(v => parseFloat(v)));
            volatilityChart.options.scales.y.min = Math.floor(minVol) - 1;
            volatilityChart.options.scales.y.max = Math.ceil(maxVol) + 1;
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
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: chartTextColor }
                        },
                        y: {
                            title: { display: true, text: 'Volatilitet (%)', color: chartTextColor },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
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

        if (stockAllocationChart) {
            stockAllocationChart.data.labels = months;
            stockAllocationChart.data.datasets[0].data = monthlyAllocation;
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
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: chartTextColor }
                        },
                        y: {
                            title: { display: true, text: 'Aksjeandel (%)', color: chartTextColor },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
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
            returnChart.data.datasets[0].data = periodicReturns;
            returnChart.data.datasets[0].backgroundColor = periodicReturns.map(value => value >= 0 ? accentGreen : accentRed);
            const minReturn = Math.min(...periodicReturns.map(v => parseFloat(v)));
            const maxReturn = Math.max(...periodicReturns.map(v => parseFloat(v)));
            returnChart.options.scales.y.min = Math.floor(minReturn) - 1;
            returnChart.options.scales.y.max = Math.ceil(maxReturn) + 1;
            returnChart.update();
        } else {
             const ctx = returnChartCanvas.getContext('2d');
             const minReturn = Math.min(...periodicReturns.map(v => parseFloat(v)));
             const maxReturn = Math.max(...periodicReturns.map(v => parseFloat(v)));

             returnChart = new Chart(ctx, {
                 type: 'bar',
                 data: {
                     labels: months,
                     datasets: [{
                         label: 'Månedlig avkastning (%)',
                         data: periodicReturns,
                         backgroundColor: periodicReturns.map(value => value >= 0 ? accentGreen : accentRed),
                     }]
                 },
                 options: {
                     responsive: true,
                     maintainAspectRatio: false,
                     scales: {
                         x: {
                             grid: { color: 'rgba(255, 255, 255, 0.1)' },
                             ticks: { color: chartTextColor }
                         },
                         y: {
                             title: { display: true, text: 'Avkastning (%)', color: chartTextColor },
                             grid: { color: 'rgba(255, 255, 255, 0.1)' },
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
    
    // Close modal when clicking outside of it
    disclaimerModal.addEventListener('click', (e) => {
        if (e.target === disclaimerModal) {
            hideDisclaimer();
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
