// import { Chart } from "./chart.js";

const ctx = document.getElementById("myChart");

const data = {
  // labels: [
  //   "Middle East and North Africa",
  //   "Sub-Saharan Africa",
  //   "Latin American and Caribbean",
  //   "North America",
  //   "South Asia",
  //   "Europe and Central Asia",
  //   "East Asia and Pacific",
  // ],
  labels: ["MENA", "SSA", "LAC", "NA", "SA", "ECA", "EAP"],
  datasets: [
    {
      label: "2016",
      backgroundColor: "#8FCCC8",
      borderColor: "#8FCCC8",
      data: [129, 174, 231, 289, 334, 392, 468],
    },
    {
      label: "2030",
      backgroundColor: "#FFCD65",
      borderColor: "#FFCD65",
      data: [177, 269, 290, 342, 466, 440, 602],
    },
    {
      label: "2050",
      backgroundColor: "#DD6D1D",
      borderColor: "#DD6D1D",
      data: [255, 516, 369, 396, 661, 490, 714],
    },
  ],
};

const myChart = new Chart(ctx, {
  type: "bar",
  data,
  //   plugins: {
  //     legend: {
  //         labels: {
  //             font
  //         }
  //     }
  // },
  devicePixelRatio: "1024px",
  Option: {
    maintainAspectRatio: true,
    aspectRatio: 0.8,
  },
});
