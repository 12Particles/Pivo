几个核心概念的关系是：                                                                                                          │
│   1. task 持有 attempt ，且关系是 1:n，但是当前只能维持一个活跃的 attempt                                                         │
│   2. attempt 与 coding agent excution 是 1:n ，也就是每个 attempt 里面可以进行多轮 coding agent 的交互。也是在运行时状态下，每个  │
│   attempt 里面只有一个 execution 会在执行状态。                                                                                   │
│   3. project 与 task 是 1:n， 每个project 里面可以有多个 task 。                                                                  │
│   4. 程序可以同时打开多个 project，每个project 是一个独立的窗口。                                                                 │
│   你需要按照这个逻辑关系整理一下架构。