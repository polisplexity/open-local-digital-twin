import moment from "moment";

var curYear = moment().format('YYYY'),
    curMonth = moment().format('MM');

export const CalendarEvents = [
    {
        backgroundColor: '#FFC400',
        borderColor: '#FFC400',
        title: '9:30 AM - 8:00 PM Awwards Conference',
        start: curYear + '-' + curMonth + '-04',
        end: curYear + '-' + curMonth + '-06',
    },
    {
        backgroundColor: '#da82f8',
        borderColor: '#da82f8',
        title: 'Jampack Team Meet',
        start: curYear + '-' + curMonth + '-13',
        end: curYear + '-' + curMonth + '-15'
    },
    {
        backgroundColor: '#da82f8',
        borderColor: '#da82f8',
        title: 'Project meeting with delegates',
        start: curYear + '-' + curMonth + '-19'
    },
    {
        backgroundColor: '#298DFF',
        borderColor: '#298DFF',
        title: 'Conference',
        start: curYear + '-' + curMonth + '-11',
        end: curYear + '-' + curMonth + '-13'
    },
    {
        title: 'Call back to Morgan Freeman',
        start: curYear + '-' + curMonth + '-27T10:30:00',
    },
    {
        title: 'Grocery Day',
        start: curYear + '-' + curMonth + '-27T12:00:00'
    },
    {
        title: 'Follow-up call with client',
        start: curYear + '-' + curMonth + '-7T14:30:00'
    },
    {
        title: 'Follow-up call with client',
        start: curYear + '-' + curMonth + '-07T07:00:00',
    },
    {
        title: 'Grocery Day',
        start: curYear + '-' + curMonth + '-02T07:00:00',
    },
    {
        backgroundColor: '#298DFF',
        borderColor: '#298DFF',
        title: '✈ 2:35 PM Flight to Indonesia',
        start: curYear + '-' + curMonth + '-13',
        // extendedProps: {
        //     toHtml: 'convert'
        // }
    },
    {
        backgroundColor: '#007D88',
        borderColor: '#007D88',
        title: "🎂 Boss's Birthday",
        start: curYear + '-' + curMonth + '-29',
        // extendedProps: {
        //     toHtml: 'convert'
        // }
    }
];

