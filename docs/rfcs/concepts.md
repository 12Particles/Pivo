几个核心概念的关系是：

1. 程序可以同时打开多个 project，每个project 是一个独立的窗口。
2. project 与 task 是 1:n， 每个project 里面可以有多个 task 。
3. task 持有 attempt ，且关系是 1:n，每个task在创建的时候，会同步创建对应的 attempt。但是当前只能维持一个活跃的 attempt。
4. attempt 与 coding agent excution 是 1:n ，也就是每个 attempt 里面可以进行多轮 coding agent 的交互。在运行时状态下，每个attempt 里面只有一个 execution 会在执行状态。 Task Conversation 里面是展示的事一个 attempt 里面所有 execution 的历史消息，和最新一个 execution 的实时消息。
