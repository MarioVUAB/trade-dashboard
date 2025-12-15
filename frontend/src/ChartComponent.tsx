import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

interface ChartProps {
    data: any[];
    chartId: string;
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
}

export const ChartComponent = ({ data, chartId, colors = {} }: ChartProps) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    // Refs for Series
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const upperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const lowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    // STRATEGY SERIES
    const grahamSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const lynchSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    const prevChartIdRef = useRef<string | null>(null);

    const colorsString = JSON.stringify(colors);

    // 1. Initialize Chart (Run once or on color change)
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chartColors = JSON.parse(colorsString);

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: chartColors.backgroundColor || 'transparent' },
                textColor: chartColors.textColor || '#d1d5db',
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
        });

        // Initialize Strategy Series FIRST (Background Context)
        grahamSeriesRef.current = chart.addLineSeries({
            color: '#059669', // Emerald 600 - The "Floor"
            lineWidth: 2,
            title: 'Graham Number (Valor)',
            crosshairMarkerVisible: true,
            lineStyle: 0 // Solid
        });

        lynchSeriesRef.current = chart.addLineSeries({
            color: '#3b82f6', // Blue 500 - The "Growth Path"
            lineWidth: 2,
            lineStyle: 2, // Dashed
            title: 'Lynch Fair Value',
            crosshairMarkerVisible: true
        });

        // Initialize Technical Series
        candleSeriesRef.current = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        volumeSeriesRef.current = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'right', // Overlay
            priceLineVisible: false,
            lastValueVisible: false,
        });

        upperSeriesRef.current = chart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.3)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Upper Band',
        });

        lowerSeriesRef.current = chart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.3)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Lower Band',
        });

        smaSeriesRef.current = chart.addLineSeries({
            color: '#fbbf24',
            lineWidth: 2,
            title: 'SMA 50',
        });

        emaSeriesRef.current = chart.addLineSeries({
            color: '#8b5cf6',
            lineWidth: 2,
            title: 'EMA 200 (Tendencia)',
        });

        chartRef.current = chart;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        prevChartIdRef.current = null;

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, [colorsString]);

    // 2. Update Data
    useEffect(() => {
        if (!data || data.length === 0 || !chartRef.current) return;

        const sortedData = [...data].sort((a, b) => (new Date(a.time).getTime() - new Date(b.time).getTime()));

        // Calculate Range
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        let maxVol = -Infinity;

        for (const item of sortedData) {
            const h = item.high ?? item.close;
            const l = item.low ?? item.close;
            const v = item.volume || 0;
            if (h > maxPrice) maxPrice = h;
            if (l < minPrice) minPrice = l;
            if (v > maxVol) maxVol = v;
        }

        if (minPrice === Infinity) minPrice = 0;
        if (maxPrice === -Infinity) maxPrice = 100;
        if (maxVol === -Infinity || maxVol === 0) maxVol = 1;

        const priceRange = maxPrice - minPrice;

        const candles = sortedData
            .filter(item => item.close != null)
            .map(item => ({
                time: item.time,
                open: item.open ?? item.close,
                high: item.high ?? item.close,
                low: item.low ?? item.close,
                close: item.close,
            }));

        const volumeData = sortedData.map(item => ({
            time: item.time,
            value: (minPrice - (priceRange * 0.05)) + ((item.volume || 0) / maxVol) * (priceRange * 0.45),
            color: (item.close >= (item.open ?? item.close)) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }));

        // Technicals
        const upperData = sortedData
            .filter(item => item.upper_band != null)
            .map(item => ({ time: item.time, value: item.upper_band }));

        const lowerData = sortedData
            .filter(item => item.lower_band != null)
            .map(item => ({ time: item.time, value: item.lower_band }));

        const smaData = sortedData
            .filter(item => item.sma_50 != null)
            .map(item => ({ time: item.time, value: item.sma_50 }));

        const ema200Data = sortedData
            .filter(item => item.ema_200 != null && item.ema_200 !== 0)
            .map(item => ({ time: item.time, value: item.ema_200 }));

        // Fundamentals (Strategy Lines)
        const grahamData = sortedData
            .filter(item => item.graham_number != null && item.graham_number > 0)
            .map(item => ({ time: item.time, value: item.graham_number }));

        const lynchData = sortedData
            .filter(item => item.lynch_line != null && item.lynch_line > 0)
            .map(item => ({ time: item.time, value: item.lynch_line }));

        // Set Data
        if (candleSeriesRef.current) candleSeriesRef.current.setData(candles);
        if (volumeSeriesRef.current) volumeSeriesRef.current.setData(volumeData);
        if (upperSeriesRef.current) upperSeriesRef.current.setData(upperData);
        if (lowerSeriesRef.current) lowerSeriesRef.current.setData(lowerData);
        if (smaSeriesRef.current) smaSeriesRef.current.setData(smaData);
        if (emaSeriesRef.current) emaSeriesRef.current.setData(ema200Data);

        if (grahamSeriesRef.current) grahamSeriesRef.current.setData(grahamData);
        if (lynchSeriesRef.current) lynchSeriesRef.current.setData(lynchData);

        // Add Markers
        const markers: any[] = [];
        for (const item of sortedData) {
            if (item.signal === 'BUY') {
                markers.push({
                    time: item.time,
                    position: 'belowBar',
                    color: '#10b981',
                    shape: 'arrowUp',
                    text: 'BUY',
                    size: 2,
                });
            } else if (item.signal === 'SELL') {
                markers.push({
                    time: item.time,
                    position: 'aboveBar',
                    color: '#ef4444',
                    shape: 'arrowDown',
                    text: 'SELL',
                    size: 2,
                });
            }
        }
        if (candleSeriesRef.current) candleSeriesRef.current.setMarkers(markers);

        // Update Zoom
        if (prevChartIdRef.current !== chartId && candles.length > 0) {
            chartRef.current.timeScale().fitContent();
            prevChartIdRef.current = chartId;
        }

    }, [data, chartId]);

    return (
        <div ref={chartContainerRef} style={{ width: '100%', position: 'relative' }} />
    );
};
