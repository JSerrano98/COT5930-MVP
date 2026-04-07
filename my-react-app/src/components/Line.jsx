import {Line} from 'react-chartjs-2'
import {Chart as Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, legend, Legend} from "chart.js"

Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);


export const LineGraph = () => {
    return <> Line Graph</>;
}