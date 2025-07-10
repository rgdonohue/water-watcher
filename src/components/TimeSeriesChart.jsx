import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TimeSeriesChart = ({ data, width = 800, height = 400, title = "Recent Flow Measurements" }) => {
  const svgRef = useRef();
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });

  useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const margin = { top: 40, right: 80, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Parse dates and create scales
    const parseTime = d3.timeParse("%b %d, %I:%M %p");
    const formattedData = data.map(d => ({
      ...d,
      parsedDate: d.parsedDate instanceof Date ? d.parsedDate : parseTime(d.dateTime),
      flow: +d.flow
    })).filter(d => d.parsedDate !== null);

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(formattedData, d => d.parsedDate))
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(formattedData, d => d.flow))
      .nice()
      .range([innerHeight, 0]);

    // Color scale for conditions
    const colorScale = d3.scaleOrdinal()
      .domain(['Normal', 'High', 'Low', 'Flood', 'Drought'])
      .range(['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#991b1b']);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickSize(-innerHeight)
        .tickFormat('')
      )
      .style('stroke-dasharray', '2,2')
      .style('opacity', 0.1);

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickFormat('')
      )
      .style('stroke-dasharray', '2,2')
      .style('opacity', 0.1);

    // Create line generator
    const line = d3.line()
      .x(d => xScale(d.parsedDate))
      .y(d => yScale(d.flow))
      .curve(d3.curveMonotoneX);

    // Add the line
    g.append('path')
      .datum(formattedData)
      .attr('fill', 'none')
      .attr('stroke', '#2563eb')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add circles for data points
    g.selectAll('.dot')
      .data(formattedData)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.parsedDate))
      .attr('cy', d => yScale(d.flow))
      .attr('r', 4)
      .attr('fill', d => colorScale(d.condition))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).transition().duration(100).attr('r', 6);
        
        const formatTime = d3.timeFormat("%b %d, %I:%M %p");
        setTooltip({
          show: true,
          x: event.pageX + 10,
          y: event.pageY - 10,
          content: `
            <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
              <div><strong>${formatTime(d.parsedDate)}</strong></div>
              <div>Flow: <strong>${d.flow} cfs</strong></div>
              <div>Condition: <strong style="color: ${colorScale(d.condition)}">${d.condition}</strong></div>
            </div>
          `
        });
      })
      .on('mouseout', function() {
        d3.select(this).transition().duration(100).attr('r', 4);
        setTooltip({ show: false, x: 0, y: 0, content: '' });
      });

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%I:%M %p"))
        .ticks(6)
      )
      .style('font-size', '12px');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale)
        .ticks(8)
      )
      .style('font-size', '12px');

    // Add axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Flow (cfs)');

    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Time');

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text(title);

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);

    const conditions = [...new Set(formattedData.map(d => d.condition))];
    
    conditions.forEach((condition, i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);

      legendRow.append('circle')
        .attr('r', 6)
        .attr('fill', colorScale(condition))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      legendRow.append('text')
        .attr('x', 15)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .text(condition);
    });

  }, [data, width, height, title]);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ 
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
      {tooltip.show && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            pointerEvents: 'none',
            zIndex: 1000
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
};

export default TimeSeriesChart; 