import dynamic from 'next/dynamic';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const AudienceReviewChart = () => {
    var options = {

        chart: {
            type: 'bar',
            height: 270,
            width: '100%',
            stacked: true,
            toolbar: {
                show: false
            },
            zoom: {
                enabled: false
            },
            foreColor: "#646A71",
            fontFamily: 'DM Sans',
        },

        grid: {
            borderColor: 'var(--bs-gray-100)',
        },

        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '35%',
                borderRadius: 5,    
                borderRadiusApplication: "end",
                borderRadiusWhenStacked: "last",
            },
        },
        xaxis: {
            type: 'datetime',
            categories: [
                '01/02/2021 GMT',
                '01/03/2021 GMT',
                '01/04/2021 GMT',
                '01/05/2021 GMT',
                '01/06/2021 GMT',
                '01/07/2021 GMT',
                '01/08/2021 GMT',
                '01/09/2021 GMT',
                '01/10/2021 GMT',
                '01/11/2021 GMT',
                '01/12/2021 GMT',
                '01/13/2021 GMT',

            ],

            labels: {
                style: {
                    fontSize: '12px',
                    fontFamily: 'inherit',
                },
            },
            axisBorder: {
                show: false,
            },
            title: {
                style: {
                    fontSize: '12px',
                    fontFamily: 'inherit',
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    fontSize: '12px',
                    fontFamily: 'inherit',
                },
            },
            title: {
                style: {
                    fontSize: '12px',
                    fontFamily: 'inherit',
                }
            },
        },
        legend: {
            show: true,
            position: 'top',
            fontSize: '15px',
            labels: {
                colors: '#6f6f6f',
            },
            markers: {
                size: 5,
                shape: "circle",

            },
            itemMargin: {
                vertical: 5
            },
        },

        colors: ['#007D88', '#25cba1', '#ebf3fe'],
        fill: {
            opacity: 1
        },
        dataLabels: {
            enabled: false,
        }
    };

    const series = [{
        name: 'Direct',
        data: [44, 55, 41, 67, 22, 43, 44, 55, 41, 67, 22, 43]
    }, {
        name: 'Organic Search',
        data: [13, 23, 20, 8, 13, 27, 13, 23, 20, 8, 13, 27]
    }, {
        name: 'Referral',
        data: [11, 17, 15, 15, 21, 14, 11, 17, 15, 15, 21, 14]
    }];

    return <ReactApexChart options={options} series={series} type="bar" height={270} width="100%" />
}

export default AudienceReviewChart
