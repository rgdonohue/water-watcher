import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TimeSeriesChart = ({ data, comparisonData = [], width = 800, height = 400, title = "Recent Flow Measurements" }) => {
  const svgRef = useRef();
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });
  const tooltipTimeoutRef = useRef(null);

  useEffect(() => {
    console.log('TimeSeriesChart updating with:', { 
      primaryData: data?.length || 0, 
      comparisonData: comparisonData?.length || 0 
    });
    
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const margin = { top: 40, right: 180, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Parse dates and create scales
    const parseTime = d3.timeParse("%b %d, %I:%M %p");
    
    // Format primary data
    const formattedData = data.map(d => ({
      ...d,
      parsedDate: d.parsedDate instanceof Date ? d.parsedDate : parseTime(d.dateTime),
      flow: +d.flow,
      series: 'primary'
    })).filter(d => d.parsedDate !== null)
      .sort((a, b) => a.parsedDate - b.parsedDate);

    // Format comparison data if available
    const formattedComparisonData = comparisonData.length > 0 ? comparisonData.map(d => ({
      ...d,
      parsedDate: d.parsedDate instanceof Date ? d.parsedDate : parseTime(d.dateTime),
      flow: +d.flow,
      series: 'comparison'
    })).filter(d => d.parsedDate !== null)
      .sort((a, b) => a.parsedDate - b.parsedDate) : [];

    // Combine data for scale calculations
    const allData = [...formattedData, ...formattedComparisonData];

    // Create scales based on combined data
    const xScale = d3.scaleTime()
      .domain(d3.extent(allData, d => d.parsedDate))
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(allData, d => d.flow))
      .nice()
      .range([innerHeight, 0]);

    // Color scale for conditions
    const conditionColorScale = d3.scaleOrdinal()
      .domain(['Normal', 'High', 'Low', 'Flood', 'Drought'])
      .range(['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#991b1b']);

    // Series color scale
    const seriesColorScale = d3.scaleOrdinal()
      .domain(['primary', 'comparison'])
      .range(['#2563eb', '#f59e0b']); // Blue for primary, orange for comparison

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

    // Add the primary line
    g.append('path')
      .datum(formattedData)
      .attr('fill', 'none')
      .attr('stroke', seriesColorScale('primary'))
      .attr('stroke-width', 3)
      .attr('d', line)
      .style('opacity', 0.9)
      .attr('class', 'primary-line');

    // Add the comparison line if data exists
    if (formattedComparisonData.length > 0) {
      g.append('path')
        .datum(formattedComparisonData)
        .attr('fill', 'none')
        .attr('stroke', seriesColorScale('comparison'))
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '5,5') // Dashed line for comparison
        .attr('d', line)
        .style('opacity', 0.9)
        .attr('class', 'comparison-line');
    }

    // Add highlight circles for each series
    const highlightCirclePrimary = g.append('circle')
      .attr('r', 5)
      .attr('fill', seriesColorScale('primary'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('opacity', 0)
      .style('pointer-events', 'none')
      .attr('class', 'highlight-primary');

    const highlightCircleComparison = g.append('circle')
      .attr('r', 5)
      .attr('fill', seriesColorScale('comparison'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('opacity', 0)
      .style('pointer-events', 'none')
      .attr('class', 'highlight-comparison');

    // Add invisible overlay for hover interaction
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function(event) {
        // Clear any pending hide timeout
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        
        const [mouseX, mouseY] = d3.pointer(event);
        const xDate = xScale.invert(mouseX);
        
        // Helper function to find closest point in a dataset
        const findClosestPoint = (dataset) => {
          if (dataset.length === 0) return null;
          
          const bisectDate = d3.bisector(d => d.parsedDate).left;
          const i = bisectDate(dataset, xDate, 1);
          
          const d0 = dataset[i - 1];
          const d1 = dataset[i];
          
          if (d0 && d1) {
            return Math.abs(xDate - d0.parsedDate) < Math.abs(xDate - d1.parsedDate) ? d0 : d1;
          } else if (d0) {
            return d0;
          } else if (d1) {
            return d1;
          }
          return null;
        };
        
        // Find closest points in both datasets
        const primaryPoint = findClosestPoint(formattedData);
        const comparisonPoint = findClosestPoint(formattedComparisonData);
        
        // Show highlight circles for available data points
        if (primaryPoint) {
          highlightCirclePrimary
            .transition()
            .duration(100)
            .attr('cx', xScale(primaryPoint.parsedDate))
            .attr('cy', yScale(primaryPoint.flow))
            .style('opacity', 1);
        } else {
          highlightCirclePrimary.style('opacity', 0);
        }
        
        if (comparisonPoint) {
          highlightCircleComparison
            .transition()
            .duration(100)
            .attr('cx', xScale(comparisonPoint.parsedDate))
            .attr('cy', yScale(comparisonPoint.flow))
            .style('opacity', 1);
        } else {
          highlightCircleComparison.style('opacity', 0);
        }
        
        // Create tooltip content if we have at least one data point
        if (primaryPoint || comparisonPoint) {
          const svgElement = svgRef.current;
          const svgRect = svgElement.getBoundingClientRect();
          const formatTime = d3.timeFormat(allData.length > 100 ? "%b %d" : "%b %d, %I:%M %p");
          
          // Use the primary point for positioning, or comparison if primary not available
          const referencePoint = primaryPoint || comparisonPoint;
          const tooltipX = svgRect.left + margin.left + xScale(referencePoint.parsedDate);
          const tooltipY = svgRect.top + margin.top + yScale(referencePoint.flow);
          
          // Smart positioning
          const tooltipWidth = 250;
          const tooltipHeight = comparisonPoint ? 120 : 80;
          
          let finalX = tooltipX + 15;
          let finalY = tooltipY - 15;
          
          if (finalX + tooltipWidth > window.innerWidth) {
            finalX = tooltipX - tooltipWidth - 15;
          }
          if (finalY < 0) {
            finalY = tooltipY + 15;
          }
          if (finalY + tooltipHeight > window.innerHeight) {
            finalY = tooltipY - tooltipHeight - 15;
          }
          
          // Build tooltip content
          let tooltipContent = `<div style="background: rgba(0,0,0,0.9); color: white; padding: 10px 14px; border-radius: 6px; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); max-width: 250px;">`;
          
          if (primaryPoint) {
            tooltipContent += `
              <div style="font-weight: bold; margin-bottom: 6px; color: ${seriesColorScale('primary')}">${primaryPoint.siteName || 'Primary Station'}</div>
              <div style="margin-bottom: 2px;">${formatTime(primaryPoint.parsedDate)}</div>
              <div style="margin-bottom: 4px;">Flow: <strong>${primaryPoint.flow.toLocaleString()} cfs</strong></div>
            `;
            
          }
          
          if (comparisonPoint) {
            if (primaryPoint) tooltipContent += `<hr style="border: 1px solid rgba(255,255,255,0.2); margin: 8px 0;">`;
            tooltipContent += `
              <div style="font-weight: bold; margin-bottom: 6px; color: ${seriesColorScale('comparison')}">${comparisonPoint.siteName || 'Comparison Station'}</div>
              <div style="margin-bottom: 2px;">${formatTime(comparisonPoint.parsedDate)}</div>
              <div style="margin-bottom: 4px;">Flow: <strong>${comparisonPoint.flow.toLocaleString()} cfs</strong></div>
            `;
            
          }
          
          tooltipContent += `</div>`;
          
          setTooltip({
            show: true,
            x: finalX,
            y: finalY,
            content: tooltipContent
          });
        }
      })
      .on('mouseout', function() {
        // Hide both highlight circles
        highlightCirclePrimary
          .transition()
          .duration(200)
          .style('opacity', 0);
        
        highlightCircleComparison
          .transition()
          .duration(200)
          .style('opacity', 0);
        
        // Hide the tooltip with a slight delay to prevent flickering
        tooltipTimeoutRef.current = setTimeout(() => {
          setTooltip({ show: false, x: 0, y: 0, content: '' });
        }, 100);
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

    let legendIndex = 0;
    
    // Helper function to wrap text into multiple lines
    const wrapText = (text, maxCharsPerLine = 18, maxLines = 2) => {
      if (!text) return [text];
      
      if (text.length <= maxCharsPerLine) return [text];
      
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (const word of words) {
        if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Single word is too long, truncate it
            lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
            currentLine = '';
          }
          
          if (lines.length >= maxLines) {
            // If we've reached max lines, truncate the last line
            if (currentLine) {
              lines[lines.length - 1] = lines[lines.length - 1].substring(0, maxCharsPerLine - 3) + '...';
            }
            break;
          }
        }
      }
      
      if (currentLine && lines.length < maxLines) {
        lines.push(currentLine);
      }
      
      return lines;
    };
    
    // Add primary station legend
    const primaryStationName = formattedData[0]?.siteName || 'Primary Station';
    const primaryLines = wrapText(primaryStationName);
    
    const primaryLegendRow = legend.append('g')
      .attr('transform', `translate(0, ${legendIndex * 25})`);
    
    primaryLegendRow.append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', seriesColorScale('primary'))
      .attr('stroke-width', 3);
    
    // Add text lines for primary station
    primaryLines.forEach((line, i) => {
      primaryLegendRow.append('text')
        .attr('x', 25)
        .attr('y', i * 12)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .style('font-weight', i === 0 ? '600' : '400')
        .text(line);
    });
    
    legendIndex += Math.max(1, primaryLines.length);
    
    // Add comparison station legend if available
    if (formattedComparisonData.length > 0) {
      const comparisonStationName = formattedComparisonData[0]?.siteName || 'Comparison Station';
      const comparisonLines = wrapText(comparisonStationName);
      
      const comparisonLegendRow = legend.append('g')
        .attr('transform', `translate(0, ${legendIndex * 25})`);
      
      comparisonLegendRow.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', seriesColorScale('comparison'))
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '5,5');
      
      // Add text lines for comparison station
      comparisonLines.forEach((line, i) => {
        comparisonLegendRow.append('text')
          .attr('x', 25)
          .attr('y', i * 12)
          .attr('dy', '0.35em')
          .style('font-size', '12px')
          .style('font-weight', i === 0 ? '600' : '400')
          .text(line);
      });
      
      legendIndex += Math.max(1, comparisonLines.length);
    }

    // Cleanup function to clear any pending timeouts
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
    };
  }, [data, comparisonData, width, height, title]);

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