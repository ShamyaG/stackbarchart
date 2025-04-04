import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  date: string;
  category: string;
  value: number;
}

interface QuarterlyTarget {
  date: string;
  value: number;
}

interface StackedBarChartProps {
  width?: number;
  height?: number;
  initialData?: DataPoint[];
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({ 
  width = 800, 
  height = 400,
  initialData
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<DataPoint[]>(initialData || [
    { date: '2024-01', category: 'A', value: 20 },
    { date: '2024-01', category: 'B', value: 30 },
    { date: '2024-01', category: 'C', value: 15 },
    { date: '2024-02', category: 'A', value: 25 },
    { date: '2024-02', category: 'B', value: 35 },
    { date: '2024-02', category: 'C', value: 20 },
    { date: '2024-03', category: 'A', value: 30 },
    { date: '2024-03', category: 'B', value: 25 },
    { date: '2024-03', category: 'C', value: 25 },
  ]);
  
  const [quarterlyTargets, setQuarterlyTargets] = useState<QuarterlyTarget[]>([
    { date: '2024-01', value: 50 },
    { date: '2024-02', value: 60 },
    { date: '2024-03', value: 70 },
  ]);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 20, right: 120, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Clear previous content with transition
    svg.selectAll('*').transition().duration(300).remove();

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Group data by date and stack it
    const groupedData = d3.group(data, d => d.date);
    const categories = Array.from(new Set(data.map(d => d.category)));
    
    const stack = d3.stack<any>()
      .keys(categories)
      .value((d, key) => d[1].find((item: DataPoint) => item.category === key)?.value || 0);

    const stackedData = stack(Array.from(groupedData));

    // Find max value including both data and targets
    const maxDataValue = d3.max(stackedData[stackedData.length - 1], d => d[1]) || 0;
    const maxTargetValue = d3.max(quarterlyTargets, d => d.value) || 0;
    const maxValue = Math.max(maxDataValue, maxTargetValue);

    // Scales
    const xScale = d3.scaleBand()
      .domain(Array.from(groupedData.keys()))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([innerHeight, 0]);

    const colorScale = d3.scaleOrdinal<string>()
      .domain(categories)
      .range(d3.schemeCategory10);

    // Draw bars with transition
    const categoryGroups = g.selectAll('.category')
      .data(stackedData)
      .join('g')
      .attr('class', 'category')
      .attr('fill', d => colorScale(d.key.toString()));

    // Create line generator for target line
    const targetLine = d3.line<QuarterlyTarget>()
      .x(d => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
      .y(d => yScale(d.value));

    // Add target line
    g.append('path')
      .datum(quarterlyTargets)
      .attr('class', 'target-line')
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .attr('stroke-width', 2)
      .attr('d', targetLine)
      .style('opacity', 0)
      .transition()
      .duration(750)
      .style('opacity', 1);

    // Add target values as labels
    g.selectAll('.target-label')
      .data(quarterlyTargets)
      .join('text')
      .attr('class', 'target-label')
      .attr('x', d => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.value) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'red')
      .text(d => `Target: ${d.value}`);

    // Add tooltips with proper typing
    type StackedDatum = d3.SeriesPoint<[string, DataPoint[]]>;

    categoryGroups.selectAll('rect')
      .data(d => d)
      .join('rect')
      .attr('x', d => xScale(d.data[0]) || 0)
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('width', xScale.bandwidth())
      .transition()
      .duration(750)
      .delay((_, i) => i * 50)
      .attr('y', d => yScale(d[1]))
      .attr('height', d => yScale(d[0]) - yScale(d[1]))
      .selection()
      .on('mouseover', function(event: MouseEvent, d: StackedDatum) {
        const total = d[1] - d[0];
        const category = d.data[0];
        
        const tooltip = svg.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${event.offsetX - 10},${event.offsetY - 10})`);

        tooltip.append('rect')
          .attr('fill', 'white')
          .attr('stroke', '#999')
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('width', 120)
          .attr('height', 30);

        tooltip.append('text')
          .attr('x', 5)
          .attr('y', 20)
          .text(`${category}: ${total}`);
      })
      .on('mouseout', () => {
        svg.selectAll('.tooltip').remove();
      });

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add interactive legend
    const legend = svg.append('g')
      .attr('font-family', 'sans-serif')
      .attr('font-size', 10)
      .attr('text-anchor', 'start')
      .selectAll('g')
      .data(categories)
      .join('g')
      .attr('transform', (_, i) => `translate(${width - margin.right + 10},${margin.top + i * 20})`)
      .style('cursor', 'pointer')
      .on('click', (_event, category) => {
        const opacity = categoryGroups
          .filter(d => d.key === category)
          .style('opacity');
        
        categoryGroups
          .filter(d => d.key === category)
          .transition()
          .style('opacity', opacity === '1' ? '0.2' : '1');
      });

    legend.append('rect')
      .attr('x', -17)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => colorScale(d));

    legend.append('text')
      .attr('x', 0)
      .attr('y', 12)
      .text(d => d);

  }, [data, width, height, quarterlyTargets]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3>Quarterly Targets:</h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {quarterlyTargets.map((target, index) => (
            <div key={target.date} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor={`target-${index}`}>
                {target.date}:
              </label>
              <input
                id={`target-${index}`}
                type="number"
                value={target.value}
                onChange={(e) => {
                  const newTargets = [...quarterlyTargets];
                  newTargets[index] = {
                    ...newTargets[index],
                    value: Number(e.target.value)
                  };
                  setQuarterlyTargets(newTargets);
                }}
                style={{ padding: '5px', width: '80px' }}
              />
            </div>
          ))}
        </div>
      </div>
      <svg ref={svgRef}></svg>
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => {
          const newData = data.map(d => ({
            ...d,
            value: Math.floor(Math.random() * 50) + 10
          }));
          setData(newData);
        }}>
          Randomize Data
        </button>
      </div>
    </div>
  );
};

export default StackedBarChart;