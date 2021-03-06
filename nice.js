Array.prototype.take = function(n) { return this.slice(0, n) };
Array.prototype.drop = function(n) { return this.slice(n) };

const movingAverageStep = 7;
const sources = [
    'intake-cumulative',
    'intake-count',
    'zkh/intake-count',
    'new-intake',
    'zkh/new-intake',

    // 'ic-cumulative',
    'died-and-survivors-cumulative',
    'behandelduur-distribution',
    'zkh/behandelduur-distribution',
];

const indexes = {
    'intake-cumulative': 'intakeCumulative',
    'intake-count': 'intakeCount',
    'zkh/intake-count': 'intakeCountZkh',
    'new-intake': ['newIntakeConfirmed', 'newIntakeSuspected'],
    'zkh/new-intake': ['newIntakeConfirmedZkh', 'newIntakeSuspectedZkh'],
    'died-and-survivors-cumulative': ['died', 'survived', 'fromIC'],
    'behandelduur-distribution': ['hospitalizedNotIcuDay', 'stillInIcuDay', 'survivedIcuDay', 'diedIcuDay'],
    'zkh/behandelduur-distribution': ['stillInHospitalDay', 'survivedHospitalDay', 'diedHospitalDay'],
};

const descriptions = {
    date: 'Date',
    intakeCumulative: 'Total (cumulative) number of COVID-19 patients requiring ICU admission',
    newIntake: 'Number of new ICU admissions of COVID-19 patients',
    newIntakeSuspected: 'Number of new ICU admissions with COVID-19 suspection',
    movingAverageNewIntake: movingAverageStep + ' day moving average of new ICU admissions',

    intakeCount: 'Total number of COVID-19 patients in ICU',
    intakeCountZkh: 'Total number of COVID-19 patients in hospital (non-ICU)',

    intakeDelta: 'Changes of number of COVID-19 patients in ICU',
    stillInIcuDay: 'Patients still in ICU per admission date',
    // died: 'Total (cumulative) of COVID-19 patients who passed away in hospital, during or after ICU admission',
    // diedDelta: 'Number of COVID-19 patients who died in hospital during or after ICU admission',
    // fromIC: 'Total (cumulative) of COVID-19 patients that have left the ICU alive but are still hospitalized',
    // fromICDelta: 'Number of COVID-19 patients that have left the ICU alive but are still hospitalized',
    // survived: 'Total (cumulative)  of COVID-19 patients that have left the hospital alive after ICU admission',
    // survivedDelta: 'Number of COVID-19 patients that have left the hospital alive after ICU admission',
    // movingAverageIntakeDelta: movingAverageStep + ' day moving average of patients in ICU',
    newIntakeZkh: 'Number of new hospital (non-ICU) admissions of COVID-19 patients',
    newIntakeSuspectedZkh: 'Number of new hospital (non-ICU) admissions with COVID-19 suspection',
    movingAverageNewIntakeZkh: movingAverageStep + ' day moving average of new hospital admissions',
    stillInHospitalDay: 'Non-ICU Patients still in hospital per admission date',
};

const hideTableColumns = [
    // 'newIntakeZkh',
    'intakeCountZkh',
    // 'movingAverageNewIntakeZkh'
];

const mergeData = fetchedData => {
    let result = {};

    fetchedData.forEach((dataset, index) => {
        let sourceKey = sources[index];
        if (Array.isArray(indexes[sourceKey])) {
            indexes[sourceKey].forEach((key, id) => {
                dataset[id].forEach(item => {
                    if (item.date === undefined) {
                        let daysAgo = item[0] - 1;
                        item.date = moment().subtract(daysAgo, 'days').format('Y-MM-DD');
                        item.value = item[1];
                    }

                    let date = item.date;
                    if (! result[date]) {
                        result[date] = {};
                        result[date].date = item.date;
                    }
                    result[date][key] = item.value;
                });
            })
        } else {
            let key = indexes[sourceKey];
            dataset.forEach(item => {
                let date = item.date;
                if (! result[date]) {
                    result[date] = {};
                    result[date].date = item.date;
                }
                result[date][key] = item.value;
            });
        }
    });

    return result;
};

const sortData = mergedData => {
    let result = [];
    let keys = Object.keys(mergedData).sort();

    keys.forEach(key => {
        result.push(mergedData[key]);
    });

    return result;
};

const enrichData = sortedData => {
    let i = 0;
    let previous = 0;
    sortedData.forEach(item => {
        item.dateString = item.date;
        // item.date = (new Date(item.date)).toLocaleDateString('default', {month: 'short', day: 'numeric', weekday: 'short'});
        item.date = moment(item.date);

        let intake = item.newIntakeConfirmed + item.newIntakeSuspected;
        item.newIntake = {value: intake, decreasing: intake > 0 && intake < previous};
        previous = intake;
        item.newIntakeZkh = item.newIntakeConfirmedZkh + item.newIntakeSuspectedZkh;

        if (i === 0) {
            item.intakeDelta = {value: item.intakeCount, decreasing: false};
            item.diedDelta = {value: 0, decreasing: false};
            item.survivedDelta = 0;
            item.fromICDelta = 0;
        } else {
            let value = item.intakeCount - sortedData[i - 1].intakeCount;
            let diedDelta = item.died - sortedData[i - 1].died;
            item.intakeDelta = {value: value, decreasing: value < 0 || (value > 0 && value < sortedData[i - 1].intakeDelta.value)};
            item.diedDelta = {value: diedDelta, decreasing: diedDelta < sortedData[i - 1].diedDelta.value};
            item.survivedDelta = item.survived - sortedData[i - 1].survived;
            item.fromICDelta = item.fromIC - sortedData[i - 1].fromIC;
        }
        if (item.stillInIcuDay !== undefined) {
            item.stillInIcuDay = {value: item.stillInIcuDay, decreasing: item.stillInIcuDay === 0};
        }
        if (item.stillInHospitalDay !== undefined) {
            item.stillInHospitalDay = {value: item.stillInHospitalDay, decreasing: item.stillInHospitalDay === 0};
        }
        item.movingAverageNewIntake = '';
        item.movingAverageIntakeDelta = '';
        if (i >= movingAverageStep - 1) {
            let newIntakes = 0;
            let intakeDelta = 0;
            let newIntakesZkh = 0;
            for (j = i - movingAverageStep + 1; j <= i; j++) {
                newIntakes += sortedData[j].newIntake.value;
                newIntakesZkh += sortedData[j].newIntakeZkh;
                intakeDelta += sortedData[j].intakeDelta.value;
            }
            item.movingAverageNewIntake = (newIntakes / movingAverageStep).toFixed(2);
            item.movingAverageNewIntakeZkh = (newIntakesZkh / movingAverageStep).toFixed(2);
            item.movingAverageIntakeDelta = (intakeDelta / movingAverageStep).toFixed(2);
        }

        i++;
    });

    return sortedData;
};

const showTable = data => {
    const table = document.getElementById('table');
    const thead = table.appendChild(document.createElement('thead'));
    const headerRow = thead.appendChild(document.createElement('tr'));
    const keys = Object.keys(descriptions)
        .filter(item => !hideTableColumns.includes(item));
    keys.forEach(desc => headerRow.appendChild(document.createElement('td')).innerText = descriptions[desc]);

    const tbody = table.appendChild(document.createElement('tbody'));

    data.forEach(item => {
        const tr = tbody.appendChild(document.createElement('tr'));
        keys.forEach(key => {
            if (item[key] === undefined) {
                tr.appendChild(document.createElement('td'));
                return;
            }
            let value = item[key].value === undefined ? item[key] : item[key].value;
            if (key === 'date') {
                value = value.format('ddd, DD MMM');
            }
            let className = item[key].decreasing ? 'decreasing' : '';
            let td = tr.appendChild(document.createElement('td'));
            td.innerText = value;
            td.className = className;
        });
    });

    return data;
};

const showICUChart = data => {
    const datasets = [];

    datasets.push(
        // {
        //     fill: false,
        //     borderColor: '#a0a',
        //     label: descriptions.intakeCumulative,
        //     data: data
        //         // .filter(item => item.intakeCumulative > 0)
        //         .map(item => {return {x: item.date, y: item.intakeCumulative}}),
        // },
        {
            fill: false,
            borderColor: '#f00',
            label: descriptions.intakeCount,
            data: data
                // .filter(item => item.intakeCount > 0)
                .map(item => {return {x: item.date, y: item.intakeCount}}),
        },
        {
            type: 'bar',
            backgroundColor: 'rgba(255, 128, 0, .3)',
            label: descriptions.newIntake,
            data: data
                // .filter(item => item.newIntake.value > 0)
                .map(item => {return {x: item.date, y: item.newIntake.value}}),
            yAxisID: 'y2'
        },
        {
            fill: false,
            borderColor: '#844',
            label: descriptions.movingAverageNewIntake,
            data: data
                .filter(item => item.movingAverageNewIntake > 0)
                .map(item => {return {x: item.date, y: item.movingAverageNewIntake}}),
            yAxisID: 'y2'
        },
    );

    console.log(datasets);

    let canvas = document.getElementById("canvas");
    let chart = new Chart(canvas, {
        type: 'line',
        // labels: [1, 2, 3],
        // labels: data.map(item => item.date.format('DDD')),
        data: {
            datasets
        },
        options: {
            title: {
                display: true,
                fontSize: 24,
                text: 'COVID-19 ICU cases in NL'
            },
            scales: {
                x: {
                    scaleLabel: {
                        display: true,
                        labelString: 'Data source: https://www.stichting-nice.nl/',
                    },
                    type: 'time',
                    display: true,
                    ticks: {
                        major: {
                            enabled: true
                        }
                    }
                },
                y: {
                    scaleLabel: {
                        display: true,
                        labelString: 'Totals',
                    },
                    ticks: {
                        beginAtZero: true,

                        // callback: (value, index, values) => {console.log(values); return value;}
                    },
                    // type: "logarithmic",
                },
                y2: {
                    scaleLabel: {
                        display: true,
                        labelString: 'New admissions (average)',
                    },
                    position: 'right',
                    ticks: {
                        beginAtZero: true,

                        // callback: (value, index, values) => {console.log(values); return value;}
                    },
                    // type: "logarithmic",
                }
            },
        }
    });

    return data;
};

const showTotalsChart = data => {
    const datasets = [];

    datasets.push(
        {
            fill: false,
            borderColor: '#00f',
            label: descriptions.intakeCountZkh,
            data: data
                .map(item => {return {x: item.date, y: item.intakeCountZkh}}),
        },
        {
            // type: 'bar',
            fill: false,
            borderColor: '#f00',
            // backgroundColor: 'rgba(255, 128, 0, .5)',
            label: descriptions.intakeCount,
            data: data
                .map(item => {return {x: item.date, y: item.intakeCount}}),
            // yAxisID: 'y2'
        },
    );

    console.log(datasets);

    let canvas = document.getElementById("canvas2");
    let chart = new Chart(canvas, {
        type: 'line',
        data: {
            datasets
        },
        options: {
            title: {
                display: true,
                fontSize: 24,
                text: 'COVID-19 Hospital/ICU cases in NL'
            },
            scales: {
                x: {
                    scaleLabel: {
                        display: true,
                        labelString: 'Data source: https://www.stichting-nice.nl/',
                    },
                    type: 'time',
                    display: true,
                    ticks: {
                        major: {
                            enabled: true
                        }
                    }
                },
                y: {
                    scaleLabel: {
                        display: true,
                        labelString: 'Totals',
                    },
                    ticks: {
                        beginAtZero: true,

                        // callback: (value, index, values) => {console.log(values); return value;}
                    },
                    // type: "logarithmic",
                },
                // y2: {
                //     scaleLabel: {
                //         display: true,
                //         labelString: 'New admissions (average)',
                //     },
                //     position: 'right',
                //     ticks: {
                //         beginAtZero: true,
                //
                //         // callback: (value, index, values) => {console.log(values); return value;}
                //     },
                //     suggestedMax: 1600,
                //     // type: "logarithmic",
                // }
            },
        }
    });

    return data;
};

const showIntakeChart = data => {
    const datasets = [];

    datasets.push(
        {
            type: 'bar',
            backgroundColor: 'rgba(0, 0, 255, .25)',
            label: descriptions.newIntakeZkh,
            data: data
                // .filter(item => item.newIntake.value > 0)
                .map(item => {return {x: item.date, y: item.newIntakeZkh}}),
        },
        {
            type: 'bar',
            backgroundColor: 'rgba(255, 0, 0, .25)',
            label: descriptions.newIntake,
            data: data
                // .filter(item => item.newIntake.value > 0)
                .map(item => {return {x: item.date, y: item.newIntake.value}}),
            // yAxisID: 'y2'
        },
        {
            fill: false,
            borderColor: '#00f',
            label: descriptions.movingAverageNewIntakeZkh,
            data: data
                .map(item => {return {x: item.date, y: item.movingAverageNewIntakeZkh}}),
        },
        {
            // type: 'bar',
            fill: false,
            borderColor: '#f00',
            // backgroundColor: 'rgba(255, 128, 0, .5)',
            label: descriptions.movingAverageNewIntake,
            data: data
                .map(item => {return {x: item.date, y: item.movingAverageNewIntake}}),
            // yAxisID: 'y2'
        },
    );

    console.log(datasets);

    let canvas = document.getElementById("canvas3");
    let chart = new Chart(canvas, {
        type: 'line',
        data: {
            datasets
        },
        options: {
            title: {
                display: true,
                fontSize: 24,
                text: 'COVID-19 Hospital/ICU new intakes in NL'
            },
            scales: {
                x: {
                    scaleLabel: {
                        display: true,
                        labelString: 'Data source: https://www.stichting-nice.nl/',
                    },
                    type: 'time',
                    display: true,
                    ticks: {
                        major: {
                            enabled: true
                        }
                    }
                },
                y: {
                    scaleLabel: {
                        display: true,
                        labelString: 'Totals',
                    },
                    ticks: {
                        beginAtZero: true,

                        // callback: (value, index, values) => {console.log(values); return value;}
                    },
                    // type: "logarithmic",
                    // min: 1,
                },
                // y2: {
                //     scaleLabel: {
                //         display: true,
                //         labelString: 'New admissions (average)',
                //     },
                //     position: 'right',
                //     ticks: {
                //         beginAtZero: true,
                //
                //         // callback: (value, index, values) => {console.log(values); return value;}
                //     },
                // suggestedMax: 1600,
                // type: "logarithmic",
                // }
            },
        }
    });

    return data;
};

const localSource = (source) => './' + source + '.json';
const remoteSource = (source) => 'https://www.stichting-nice.nl/covid-19/public/' + source + '/';

const fetchJson = url => fetch(url).then(response => response.ok ? response.json() : {});

Promise.all(sources.map(remoteSource).map(fetchJson))
    .then(mergeData)
    .then(sortData)
    .then(enrichData)
    .then(showTable)
    .then(showICUChart)
    .then(showTotalsChart)
    .then(showIntakeChart)
    .then(console.log)
