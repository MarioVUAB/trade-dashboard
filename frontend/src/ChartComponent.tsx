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
            height: 350,
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

        // Bollinger Bands (Lines)
        const upperBandSeries = chart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.5)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Upper Band',
        });

        const lowerBandSeries = chart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.5)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Lower Band',
        });

        const smaSeries = chart.addLineSeries({
            color: '#fbbf24', // Amber/Yellow
            lineWidth: 2,
            title: 'SMA 50',
        });

        // Transform Data
        const sortedData = [...data].sort((a, b) => (new Date(a.time).getTime() - new Date(b.time).getTime()));

        const candles = sortedData.map(item => ({
            time: item.time,
            open: item.open ?? item.close,
            high: item.high ?? item.close,
            low: item.low ?? item.close,
            close: item.close,
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

        candlestickSeries.setData(candles);
        upperBandSeries.setData(upperData);
        lowerBandSeries.setData(lowerData);
        smaSeries.setData(smaData);

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
