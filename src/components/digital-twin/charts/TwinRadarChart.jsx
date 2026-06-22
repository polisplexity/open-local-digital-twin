'use client'

import dynamic from 'next/dynamic'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const TwinRadarChart = ({ title, items }) => {
  const options = {
    chart: {
      type: 'radar',
      toolbar: { show: false },
      foreColor: '#646A71',
      fontFamily: 'DM Sans',
    },
    xaxis: {
      categories: items.map((item) => item.label),
      labels: {
        style: {
          colors: items.map(() => '#646A71'),
          fontSize: '12px',
        },
      },
    },
    yaxis: { show: false },
    stroke: { width: 2 },
    fill: { opacity: 0.16 },
    markers: { size: 4 },
    colors: ['#007D88'],
    plotOptions: { radar: { polygons: { strokeColors: '#E5EDF5', connectorColors: '#E5EDF5' } } },
  }

  return <ReactApexChart options={options} series={[{ name: title, data: items.map((item) => item.value) }]} type="radar" height={320} />
}

export default TwinRadarChart
