import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

interface ChartProps {
    data: any[];
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
}

export const ChartComponent = ({ data, colors = {} }: ChartProps) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const colorsString = JSON.stringify(colors);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

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

        // Candlestick Series (Price)
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        // Volume Series (Histogram at bottom)
        const volumeSeries = chart.addHistogramSeries({
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'right', // Attach to main scale so it moves with price
            priceLineVisible: false,
            lastValueVisible: false, // Don't show volume numbers on price axis
        });

        // Bollinger Bands (Lines)
        const upperBandSeries = chart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.3)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Upper Band',
        });

        const lowerBandSeries = chart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.3)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Lower Band',
        });

        const smaSeries = chart.addLineSeries({
            color: '#fbbf24', // Amber/Yellow
            lineWidth: 2,
            title: 'SMA 50',
        });

        const ema200Series = chart.addLineSeries({
            color: '#8b5cf6', // Violet/Purple
            lineWidth: 2,
            title: 'EMA 200 (Tendencia Macro)',
        });

        // Transform Data
        const sortedData = [...data].sort((a, b) => (new Date(a.time).getTime() - new Date(b.time).getTime()));

        // Calculate Range for Normalization
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
            .filter(item => item.close != null) // Filter out projections
            .map(item => ({
                time: item.time,
                open: item.open ?? item.close,
                high: item.high ?? item.close,
                low: item.low ?? item.close,
                close: item.close,
            }));

        // Normalize Volume to Price Scale (Overlay)
        // Max Volume will reach 20% of the price range height, starting near the bottom.
        const volumeData = sortedData.map(item => ({
            time: item.time,
            value: (minPrice - (priceRange * 0.05)) + ((item.volume || 0) / maxVol) * (priceRange * 0.45),
            color: (item.close >= (item.open ?? item.close)) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }));

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

        candlestickSeries.setData(candles);
        volumeSeries.setData(volumeData);
        upperBandSeries.setData(upperData);
        lowerBandSeries.setData(lowerData);
        smaSeries.setData(smaData);
        ema200Series.setData(ema200Data);


        // Add Markers (Signals)
        const markers: any[] = [];
        for (const item of sortedData) {
            if (item.signal === 'BUY') {
                markers.push({
                    time: item.time,
                    position: 'belowBar',
                    color: '#10b981',
                    shape: 'arrowUp',
                    text: 'BUY',
                    size: 2, // Larger
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

        candlestickSeries.setMarkers(markers);

        chart.timeScale().fitContent();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, colorsString]);

    return (
        <div ref={chartContainerRef} style={{ width: '100%', position: 'relative' }} />
    );
};
