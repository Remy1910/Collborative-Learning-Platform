// Five dummy courses, each with one 10-question quiz over three topics.
// Per quiz: 5 MCQ (2 marks, one with two correct options), 3 true/false (1 mark), 2 short answer (3 marks) = 19 marks.
const mcq = (topic, questionText, options, correct) => ({
  type: "mcq", topic, questionText, marks: 2,
  options: options.map(text => ({ text, isCorrect: [].concat(correct).includes(text) })),
});
const tf = (topic, questionText, correctAnswer) => ({ type: "truefalse", topic, questionText, marks: 1, correctAnswer });
const sa = (topic, questionText, modelAnswer) => ({ type: "shortanswer", topic, questionText, marks: 3, modelAnswer });

export const COURSES = [
  {
    title: "Data Structures",
    subject: "Computer Science",
    topics: ["Arrays", "Linked Lists", "Trees"],
    questions: [
      mcq("Arrays", "What is the time complexity of accessing an array element by index?", ["O(1)", "O(log n)", "O(n)", "O(n^2)"], "O(1)"),
      mcq("Arrays", "Which operations are O(n) in the worst case on an unsorted array?", ["Linear search", "Insert at the front", "Read by index", "Update by index"], ["Linear search", "Insert at the front"]),
      mcq("Linked Lists", "What does each node of a singly linked list store?", ["Data and a pointer to the next node", "Only data", "Data and pointers to two children", "An index"], "Data and a pointer to the next node"),
      mcq("Trees", "In a binary search tree, where are values smaller than the root stored?", ["Left subtree", "Right subtree", "Either subtree", "Only in leaves"], "Left subtree"),
      mcq("Trees", "Which traversal of a binary search tree visits keys in sorted order?", ["In-order", "Pre-order", "Post-order", "Level-order"], "In-order"),
      tf("Linked Lists", "Inserting at the head of a singly linked list takes O(1) time.", true),
      tf("Arrays", "A static array can grow beyond its declared size without reallocation.", false),
      tf("Trees", "Every binary tree is a binary search tree.", false),
      sa("Linked Lists", "Explain one advantage of a doubly linked list over a singly linked list.", "It can be traversed backwards and a node can be deleted in O(1) given a pointer to it."),
      sa("Trees", "What is the height of a balanced binary search tree with n nodes, and why does it matter?", "About log2(n); search, insert and delete take time proportional to the height."),
    ],
  },
  {
    title: "Database Systems",
    subject: "Computer Science",
    topics: ["SQL", "Normalization", "Transactions"],
    questions: [
      mcq("SQL", "Which SQL clause filters groups after aggregation?", ["HAVING", "WHERE", "ORDER BY", "LIMIT"], "HAVING"),
      mcq("SQL", "Which joins return rows that have no match in the other table?", ["LEFT JOIN", "FULL OUTER JOIN", "INNER JOIN", "CROSS JOIN"], ["LEFT JOIN", "FULL OUTER JOIN"]),
      mcq("Normalization", "A table is in 1NF when:", ["Every column holds atomic values", "It has no foreign keys", "It has exactly one candidate key", "It has no NULLs"], "Every column holds atomic values"),
      mcq("Normalization", "2NF removes which kind of dependency?", ["Partial dependency on part of a composite key", "Transitive dependency", "Multivalued dependency", "Join dependency"], "Partial dependency on part of a composite key"),
      mcq("Transactions", "Which ACID property guarantees a committed change survives a crash?", ["Durability", "Atomicity", "Isolation", "Consistency"], "Durability"),
      tf("SQL", "A PRIMARY KEY column may contain duplicate values.", false),
      tf("Transactions", "A dirty read is reading data written by an uncommitted transaction.", true),
      tf("Normalization", "Higher normal forms always make queries faster.", false),
      sa("Transactions", "What does atomicity mean for a bank transfer between two accounts?", "Both the debit and the credit happen, or neither does."),
      sa("Normalization", "Give one problem caused by storing data redundantly in an unnormalized table.", "Update anomalies: changing a fact in one row leaves stale copies in others."),
    ],
  },
  {
    title: "Computer Networks",
    subject: "Computer Science",
    topics: ["OSI Model", "TCP/IP", "Routing"],
    questions: [
      mcq("OSI Model", "At which OSI layer does a router mainly operate?", ["Network", "Data link", "Transport", "Session"], "Network"),
      mcq("OSI Model", "Which of these are application-layer protocols?", ["HTTP", "DNS", "IP", "Ethernet"], ["HTTP", "DNS"]),
      mcq("TCP/IP", "How many packets does the TCP three-way handshake use?", ["3", "2", "4", "1"], "3"),
      mcq("TCP/IP", "Which protocol is connectionless?", ["UDP", "TCP", "FTP", "SMTP"], "UDP"),
      mcq("Routing", "Which routing protocol is distance-vector?", ["RIP", "OSPF", "IS-IS", "BGP-LS"], "RIP"),
      tf("TCP/IP", "TCP guarantees in-order delivery of bytes.", true),
      tf("Routing", "A default route is used when no more specific route matches.", true),
      tf("OSI Model", "The physical layer handles IP addressing.", false),
      sa("Routing", "Why do link-state protocols such as OSPF converge faster than RIP?", "Each router has the full topology and computes shortest paths itself instead of waiting for neighbours' distance updates."),
      sa("TCP/IP", "What is the purpose of the TCP sliding window?", "Flow control: it limits how much unacknowledged data the sender may have in flight."),
    ],
  },
  {
    title: "Operating Systems",
    subject: "Computer Science",
    topics: ["Processes", "Memory Management", "Scheduling"],
    questions: [
      mcq("Processes", "Which system call creates a new process in Unix?", ["fork()", "exec()", "wait()", "exit()"], "fork()"),
      mcq("Memory Management", "Which of these reduce external fragmentation?", ["Paging", "Compaction", "Contiguous allocation", "Larger partitions"], ["Paging", "Compaction"]),
      mcq("Memory Management", "A page fault occurs when:", ["The page is not in physical memory", "The CPU overheats", "A process divides by zero", "The disk is full"], "The page is not in physical memory"),
      mcq("Scheduling", "Which scheduling algorithm can starve long jobs?", ["Shortest Job First", "Round Robin", "First Come First Served", "Lottery"], "Shortest Job First"),
      mcq("Scheduling", "What does Round Robin use to preempt processes?", ["A time quantum", "Priority aging", "Job length", "Arrival order only"], "A time quantum"),
      tf("Processes", "Threads of the same process share its address space.", true),
      tf("Scheduling", "First Come First Served is a preemptive algorithm.", false),
      tf("Memory Management", "Virtual memory lets a process use more memory than is physically installed.", true),
      sa("Processes", "Name the four necessary conditions for deadlock.", "Mutual exclusion, hold and wait, no preemption, circular wait."),
      sa("Memory Management", "What is thrashing?", "The system spends most of its time swapping pages in and out instead of executing."),
    ],
  },
  {
    title: "Web Development",
    subject: "Computer Science",
    topics: ["HTML/CSS", "JavaScript", "HTTP"],
    questions: [
      mcq("HTML/CSS", "Which CSS property makes an element a flex container?", ["display: flex", "position: flex", "float: flex", "flex: container"], "display: flex"),
      mcq("JavaScript", "Which declarations create block-scoped variables?", ["let", "const", "var", "function"], ["let", "const"]),
      mcq("JavaScript", "What does Promise.all reject with?", ["The first rejection reason", "An array of all errors", "undefined", "The last rejection reason"], "The first rejection reason"),
      mcq("HTTP", "Which HTTP status code means 'Not Found'?", ["404", "401", "500", "302"], "404"),
      mcq("HTTP", "Which HTTP method is idempotent?", ["PUT", "POST", "PATCH", "CONNECT"], "PUT"),
      tf("HTML/CSS", "The <div> element is an inline element by default.", false),
      tf("JavaScript", "JavaScript is single-threaded with an event loop.", true),
      tf("HTTP", "HTTP is a stateless protocol.", true),
      sa("HTTP", "What problem does CORS solve, and who enforces it?", "It lets servers allow cross-origin requests that browsers would otherwise block; the browser enforces it."),
      sa("JavaScript", "Explain the difference between == and === in JavaScript.", "== compares after type coercion; === compares value and type without coercion."),
    ],
  },
];
