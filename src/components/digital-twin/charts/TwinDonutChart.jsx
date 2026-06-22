'use client'

import dynamic from 'next/dynamic'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const TwinDonutChart = ({ items }) => {
  const options = {
    chart: {
      type: 'donut',
      foreColor: '#646A71',
      fontFamily: 'DM Sans',
    },
    labels: items.map((item) => item.label),
    colors: items.map((item) => item.theme),
    legend: {
      position: 'bottom',
      labels: { colors: '#646A71' },
    },
    stroke: { colors: ['#ffffff'] },
    dataLabels: { enabled: false },
  }

  return <ReactApexChart options={options} series={items.map((item) => item.value)} type="donut" height={320} />
}

export default TwinDonutChart
