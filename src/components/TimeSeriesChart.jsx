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

    // Add the line with better visibility
    g.append('path')
      .datum(formattedData)
      .attr('fill', 'none')
      .attr('stroke', '#2563eb')
      .attr('stroke-width', 3)
      .attr('d', line)
      .style('opacity', 0.9);

    // Add invisible overlay for hover interaction
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function(event) {
        const [mouseX] = d3.pointer(event);
        const xDate = xScale.invert(mouseX);
        
        // Find closest data point
        const bisectDate = d3.bisector(d => d.parsedDate).left;
        const i = bisectDate(formattedData, xDate, 1);
        const d0 = formattedData[i - 1];
        const d1 = formattedData[i];
        const d = d1 && (xDate - d0.parsedDate > d1.parsedDate - xDate) ? d1 : d0;
        
        if (d) {
          const formatTime = d3.timeFormat(formattedData.length > 100 ? "%b %d" : "%b %d, %I:%M %p");
          setTooltip({
            show: true,
            x: event.pageX + 10,
            y: event.pageY - 10,
            content: `
              <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
                <div><strong>${formatTime(d.parsedDate)}</strong></div>
                <div>Flow: <strong>${d.flow.toLocaleString()} cfs</strong></div>
                <div>Condition: <strong style="color: ${colorScale(d.condition)}">${d.condition}</strong></div>
              </div>
            `
          });
        }
      })
      .on('mouseout', function() {
        setTooltip({ show: false, x: 0, y: 0, content: '' });
      });

    // Add X axis with smart formatting based on data range
    const timeRange = d3.extent(formattedData, d => d.parsedDate);
    const daysDiff = (timeRange[1] - timeRange[0]) / (1000 * 60 * 60 * 24);
    
    let tickFormat, tickCount;
    if (daysDiff > 60) {
      // More than 60 days - show months
      tickFormat = d3.timeFormat("%b %Y");
      tickCount = 4;
    } else if (daysDiff > 7) {
      // More than 7 days - show dates
      tickFormat = d3.timeFormat("%b %d");
      tickCount = 6;
    } else if (daysDiff > 1) {
      // More than 1 day - show day and time
      tickFormat = d3.timeFormat("%m/%d %I%p");
      tickCount = 6;
    } else {
      // Less than 1 day - show time only
      tickFormat = d3.timeFormat("%I:%M %p");
      tickCount = 8;
    }
    
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(tickFormat)
        .ticks(tickCount)
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