'use client'

import dynamic from 'next/dynamic'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const TwinHorizontalBarChart = ({ items }) => {
  const options = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      foreColor: '#646A71',
      fontFamily: 'DM Sans',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
      },
    },
    colors: items.map((item) => item.theme),
    dataLabels: { enabled: false },
    xaxis: {
      categories: items.map((item) => item.label),
      labels: { style: { colors: '#646A71' } },
    },
    grid: {
      borderColor: '#E5EDF5',
    },
  }

  return <ReactApexChart options={options} series={[{ data: items.map((item) => item.value) }]} type="bar" height={320} />
}

export default TwinHorizontalBarChart
