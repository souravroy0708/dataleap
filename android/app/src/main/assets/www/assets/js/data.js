/* DataLeap content: DE-specific DSA and system design items for staff-level (10+ yrs) loops.
   This file is the single source of truth for the static site and later becomes the Django seed.
   Rule: titles + links + our own short text only. Never paste problem statements from other platforms. */
(function () {
  const NC = (slug) => [{ p: 'NeetCode', url: 'https://neetcode.io/problems/' + slug }];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const items = [];

  // ---------- DSA ----------
  const dsaTopics = [
    { code: 'D1', name: 'Arrays and hashing', priority: 1, why: 'Dedupe, counting and group-by are the most common DE coding asks.' },
    { code: 'D2', name: 'Strings and parsing', priority: 1, why: 'Logs, CSV rows and messy records.' },
    { code: 'D3', name: 'Two pointers and sliding window', priority: 1, why: 'Rolling metrics and windowed aggregates.' },
    { code: 'D4', name: 'Intervals and sorting', priority: 1, why: 'Sessions, overlapping time ranges, concurrency.' },
    { code: 'D5', name: 'Heaps and top-K', priority: 1, why: 'Top-K, merging sorted files, streaming medians.' },
    { code: 'D6', name: 'Data-processing coding', priority: 1, why: 'Practical rounds: JSON, joins, files larger than memory.' },
    { code: 'D11', name: 'Design a data structure', priority: 1, why: 'LRU, rate limiters, KV stores: staff loops like these.' },
    { code: 'D10', name: 'Graphs and DAGs', priority: 2, why: 'Pipeline dependencies, identity resolution, cycles.' },
    { code: 'D8', name: 'Binary search', priority: 2, why: 'Search in sorted data and capacity planning style questions.' },
    { code: 'D7', name: 'Stacks and queues', priority: 2, why: 'Parsing expressions, monotonic patterns.' },
    { code: 'D9', name: 'Hierarchies and tries', priority: 2, why: 'Category trees, org charts, prefix lookups, serialisation.' },
    { code: 'D12', name: 'Matching with dynamic programming', priority: 3, why: 'Rare in DE loops. Only the record-matching kind.' }
  ];

  function q(topic, title, diff, o) {
    o = o || {};
    items.push({
      id: 'd-' + slug(title), track: 'dsa', topic, title, diff,
      type: 'question', links: o.lc ? NC(o.lc) : (o.links || []), text: o.text || '',
      angle: o.angle || '', premium: !!o.prem
    });
  }

  q('D1', 'Two Sum', 'Easy', { lc: 'two-integer-sum', angle: 'A hash join in miniature: build on one side, probe with the other.' });
  q('D1', 'Contains Duplicate', 'Easy', { lc: 'duplicate-integer', angle: 'Duplicate detection on ingestion.' });
  q('D1', 'Majority Element', 'Easy', { lc: 'majority-element', angle: 'Find the dominant value in a column.' });
  q('D1', 'Group Anagrams', 'Medium', { lc: 'anagram-groups', angle: 'Group-by on a derived key.' });
  q('D1', 'Longest Consecutive Sequence', 'Medium', { lc: 'longest-consecutive-sequence', angle: 'Longest streak of active days per user.' });
  q('D1', 'Subarray Sum Equals K', 'Medium', { lc: 'subarray-sum-equals-k', angle: 'Prefix sums, the basis of running totals.' });
  q('D1', 'Deduplicate events by event_id, keeping the latest version', 'Medium', { text: 'Given a list of event dicts with event_id, updated_at and payload, return one event per id, the latest by updated_at. Follow-up: input does not fit in memory.' });
  q('D1', 'Group-by and aggregate a list of records without pandas', 'Easy', { text: 'Given rows as dicts, return sum, count and average of amount per (country, day). Follow-up: support several aggregate functions passed as arguments.' });

  q('D2', 'Longest Common Prefix', 'Easy', { lc: 'longest-common-prefix', angle: 'Common prefix of object-store paths.' });
  q('D2', 'Decode String', 'Medium', { lc: 'decode-string', angle: 'Expanding nested, templated paths and configs.' });
  q('D2', 'Simplify Path', 'Medium', { lc: 'simplify-path', angle: 'Normalising object-store paths.' });
  q('D2', 'String Compression', 'Medium', { lc: 'string-compression', angle: 'Run-length encoding, used by columnar formats.' });
  q('D2', 'Parse access logs and report p95 latency per endpoint', 'Medium', { text: 'Each line holds timestamp, method, path, status and latency_ms. Return p95 latency and error rate per path. Follow-up: stream a 50 GB file.' });
  q('D2', 'Validate CSV rows and quarantine bad records', 'Medium', { text: 'Parse rows against a schema (types, required fields). Return good rows and a list of bad rows with the reason. Handle quoted commas.' });

  q('D3', 'Best Time to Buy and Sell Stock', 'Easy', { lc: 'buy-and-sell-crypto', angle: 'Single pass over a metric stream, keeping the running minimum.' });
  q('D3', 'Minimum Window Substring', 'Hard', { lc: 'minimum-window-with-characters', angle: 'Shortest time window that contains every required event type.' });
  q('D3', 'Sliding Window Maximum', 'Hard', { lc: 'sliding-window-maximum', angle: 'Rolling max over a metric stream.' });
  q('D3', 'Rolling 7-day active users from daily login events', 'Medium', { text: 'Given (user_id, date) login rows, return for each date the count of distinct users active in the trailing 7 days.' });

  q('D4', 'Merge Intervals', 'Medium', { lc: 'merge-intervals', angle: 'Merging overlapping user sessions or booking windows.' });
  q('D4', 'Insert Interval', 'Medium', { lc: 'insert-new-interval', angle: 'Placing a late-arriving session into already sorted sessions.' });
  q('D4', 'Non-overlapping Intervals', 'Medium', { lc: 'non-overlapping-intervals', angle: 'Fewest jobs to drop so no two runs overlap on one cluster.' });
  q('D4', 'Meeting Rooms II', 'Medium', { lc: 'meeting-schedule-ii', angle: 'Peak concurrency.' });
  q('D4', 'Interval List Intersections', 'Medium', { lc: 'interval-list-intersections', angle: 'When were a driver and a rider both active? Overlap of two timelines.' });
  q('D4', 'Car Pooling', 'Medium', { lc: 'car-pooling', angle: 'Capacity over time from start/end events.' });
  q('D4', 'Sessionise a clickstream with a 30-minute inactivity gap', 'Medium', { text: 'Given (user_id, ts) events, unsorted, assign a session_id per user where a gap over 30 minutes starts a new session. Return session count and average length per user.' });
  q('D4', 'Peak concurrent rides from trip start and end events', 'Medium', { text: 'Given trips with start and end timestamps per city, return the peak number of concurrent trips per city and when it happened.' });

  q('D5', 'Kth Largest Element in an Array', 'Medium', { lc: 'kth-largest-element-in-an-array', angle: 'Percentile thresholds without a full sort.' });
  q('D5', 'Merge Two Sorted Lists', 'Easy', { lc: 'merge-two-sorted-linked-lists', angle: 'Merging two sorted part files.' });
  q('D5', 'Top K Frequent Elements', 'Medium', { lc: 'top-k-elements-in-list', angle: 'Top-K products or hot keys by count.' });
  q('D5', 'Kth Largest Element in a Stream', 'Easy', { lc: 'kth-largest-integer-in-a-stream', angle: 'Running top-K over a stream.' });
  q('D5', 'K Closest Points to Origin', 'Medium', { lc: 'k-closest-points-to-origin', angle: 'Nearest drivers.' });
  q('D5', 'Task Scheduler', 'Medium', { lc: 'task-scheduling', angle: 'Scheduling jobs with cooldowns, like rate-limited API pulls.' });
  q('D5', 'Merge k Sorted Lists', 'Hard', { lc: 'merge-k-sorted-linked-lists', angle: 'Merging sorted part files.' });
  q('D5', 'Find Median from Data Stream', 'Hard', { lc: 'find-median-in-a-data-stream', angle: 'Streaming median latency with two heaps.' });
  q('D5', 'Top-K products from a file larger than memory', 'Medium', { text: 'A 200 GB file of order lines does not fit in RAM. Return the 100 most sold products. Discuss hashing into partitions, then a heap per partition.' });

  q('D6', 'Flatten a nested JSON record into dot-separated keys', 'Medium', { text: 'Turn {"a":{"b":1,"c":[1,2]}} into {"a.b":1,"a.c.0":1,"a.c.1":2}. Follow-up: unflatten, and cap the depth.' });
  q('D6', 'Sort-merge join of two sorted iterators', 'Medium', { text: 'Two generators yield (key, row) sorted by key. Yield joined rows for inner and left joins without loading either side into memory. Handle duplicate keys.' });
  q('D6', 'External merge sort of a file larger than memory', 'Hard', { text: 'Sort a 100 GB file of integers with 2 GB of RAM. Write the chunk-sort and k-way merge steps.' });
  q('D6', 'Generator pipeline: read, filter, map, batch', 'Easy', { text: 'Write composable generator stages that stream a file line by line and yield batches of N transformed records.' });
  q('D6', 'Reservoir sampling of a stream', 'Medium', { text: 'Keep a uniform random sample of k events from a stream of unknown length.' });
  q('D6', 'Bloom filter for already-seen event ids', 'Medium', { text: 'Implement add and might_contain with k hash functions. Explain false positive rate versus size.' });
  q('D6', 'Approximate distinct count (HyperLogLog idea)', 'Hard', { text: 'Explain and sketch a simplified HyperLogLog. When is approximate distinct count acceptable in a metrics pipeline?' });
  q('D6', 'Tumbling-window aggregator with a watermark', 'Hard', { text: 'Events arrive out of order with event_time. Emit per-minute counts once the watermark (max event_time minus 2 minutes) passes the window end. Late events go to a side output.' });
  q('D6', 'SCD type 2 upsert in plain Python', 'Medium', { text: 'Given current dimension rows and a batch of changes, close changed rows (valid_to, is_current) and insert new versions. Re-running the same batch must change nothing.' });
  q('D6', 'Detect schema drift between two batches of JSON records', 'Medium', { text: 'Report added, removed and type-changed fields, including nested ones. Decide which changes are backward compatible.' });
  q('D6', 'Hash partitioner with skew detection', 'Medium', { text: 'Assign records to N partitions by key, report the skew ratio, and salt the hot keys so no partition exceeds 2x the average.' });
  q('D6', 'Approximate p50 and p95 with a fixed-size histogram', 'Medium', { text: 'Stream latencies into fixed buckets and answer percentile queries in O(buckets). Explain the error bound.' });

  q('D11', 'LRU Cache', 'Medium', { lc: 'lru-cache', angle: 'Caching dimension lookups inside a streaming job.' });
  q('D11', 'LFU Cache', 'Hard', { lc: 'lfu-cache', angle: 'Keeping hot keys in memory under a fixed budget.' });
  q('D11', 'Insert Delete GetRandom O(1)', 'Medium', { lc: 'insert-delete-getrandom-o1', angle: 'Uniform sampling from a live set of active keys.' });
  q('D11', 'Time Based Key-Value Store', 'Medium', { lc: 'time-based-key-value-store', angle: 'Point-in-time lookups, as in SCD2 and feature stores.' });
  q('D11', 'Design Twitter', 'Medium', { lc: 'design-twitter-feed', angle: 'Merging K sorted timelines with a heap.' });
  q('D11', 'Sliding-window rate limiter per API key', 'Medium', { text: 'allow(key, ts) returns True if the key made fewer than N calls in the last W seconds. Variant: a hit counter for the last 5 minutes. Compare fixed window, sliding log and sliding counter.' });
  q('D11', 'Consistent hashing ring with virtual nodes', 'Medium', { text: 'Implement add_node, remove_node and get_node(key). Show how many keys move when a node is added.' });
  q('D11', 'In-memory key-value store with TTL and snapshots', 'Medium', { text: 'set, get, delete with optional TTL; snapshot() returns an id; get_at(key, snapshot_id).' });

  q('D10', 'Number of Islands', 'Medium', { lc: 'count-number-of-islands', angle: 'Connected demand zones on a geo grid.' });
  q('D10', 'Course Schedule', 'Medium', { lc: 'course-schedule', angle: 'Cycle detection in a pipeline DAG.' });
  q('D10', 'Course Schedule II', 'Medium', { lc: 'course-schedule-ii', angle: 'Topological run order of tasks.' });
  q('D10', 'Accounts Merge', 'Medium', { lc: 'accounts-merge', angle: 'Identity resolution across sources.' });
  q('D10', 'Evaluate Division', 'Medium', { lc: 'evaluate-division', angle: 'Currency conversion graph.' });
  q('D10', 'Network Delay Time', 'Medium', { lc: 'network-delay-time', angle: 'How long until data reaches every downstream table?' });
  q('D10', 'Redundant Connection', 'Medium', { lc: 'redundant-connection', angle: 'Union-find.' });
  q('D10', 'Alien Dictionary', 'Hard', { lc: 'foreign-dictionary', angle: 'Ordering from partial evidence (topological sort).' });
  q('D10', 'Critical path of a pipeline DAG', 'Medium', { text: 'Given tasks with durations and dependencies, return the earliest finish time of the whole DAG and the critical path. Detect cycles.' });

  q('D8', 'Binary Search', 'Easy', { lc: 'binary-search', angle: 'Finding a key inside a sorted file or partition.' });
  q('D8', 'Koko Eating Bananas', 'Medium', { lc: 'eating-bananas', angle: 'Binary search on the answer.' });
  q('D8', 'Capacity To Ship Packages Within D Days', 'Medium', { lc: 'capacity-to-ship-packages-within-d-days', angle: 'Minimum cluster size to meet an SLA.' });

  q('D7', 'Valid Parentheses', 'Easy', { lc: 'validate-parentheses', angle: 'Checking nested JSON or expression brackets are balanced.' });
  q('D7', 'Baseball Game', 'Easy', { lc: 'baseball-game', angle: 'Stack warm-up: replaying an event log.' });
  q('D7', 'Daily Temperatures', 'Medium', { lc: 'daily-temperatures', angle: 'Next spike in a metric time series.' });
  q('D7', 'Evaluate Reverse Polish Notation', 'Medium', { lc: 'evaluate-reverse-polish-notation', angle: 'The core of a tiny filter-expression engine.' });
  q('D7', 'Basic Calculator II', 'Medium', { lc: 'basic-calculator-ii', angle: 'Evaluating filter expressions.' });

  q('D9', 'Binary Tree Level Order Traversal', 'Medium', { lc: 'level-order-traversal-of-binary-tree', angle: 'Walking a hierarchy level by level: org charts, category trees.' });
  q('D9', 'Lowest Common Ancestor of a Binary Tree', 'Medium', { lc: 'lowest-common-ancestor-of-a-binary-tree', angle: 'Nearest shared parent category for two products.' });
  q('D9', 'Serialize and Deserialize Binary Tree', 'Hard', { lc: 'serialize-and-deserialize-binary-tree', angle: 'Serialising nested records for storage and transport.' });
  q('D9', 'Implement Trie (Prefix Tree)', 'Medium', { lc: 'implement-prefix-tree', angle: 'Prefix lookups on object paths and keys.' });
  q('D9', 'Design Add and Search Words Data Structure', 'Medium', { lc: 'design-word-search-data-structure', angle: 'Wildcard matching on table and column names.' });

  q('D12', 'Word Break', 'Medium', { lc: 'word-break', angle: 'Splitting concatenated fields back into known tokens.' });
  q('D12', 'Edit Distance', 'Medium', { lc: 'edit-distance', angle: 'Fuzzy matching of records.' });

  // ---------- System design ----------
  const sdTopics = [
    { code: 'SX', name: 'Design cases (staff level)', priority: 1, why: 'End-to-end designs. Practise each in parts, then whole in 60 minutes.' },
    { code: 'S1', name: 'Distributed systems fundamentals', priority: 1, why: 'Every design answer rests on these.' },
    { code: 'S3', name: 'Stream processing', priority: 1, why: 'Real-time is the default ask at Uber-style companies.' },
    { code: 'S2', name: 'Batch processing and Spark', priority: 1, why: 'Shuffle, skew and joins come up in almost every loop.' },
    { code: 'S4', name: 'Storage, formats and lakehouse', priority: 1, why: 'Where and how data is laid out decides cost and speed.' },
    { code: 'S5', name: 'Data modelling', priority: 1, why: 'Grain, SCDs and metrics consistency.' },
    { code: 'S6', name: 'Ingestion and CDC', priority: 1, why: 'Getting data in correctly, including backfills.' },
    { code: 'S13', name: 'Platform and staff judgement', priority: 1, why: 'What separates staff from senior: ownership, migrations, SLOs, cost.' },
    { code: 'S12', name: 'Estimation and cost', priority: 2, why: 'Staff candidates are expected to size and cost a design.' },
    { code: 'S8', name: 'Data quality and observability', priority: 2, why: 'Contracts, checks and lineage at platform scale.' },
    { code: 'S7', name: 'Orchestration', priority: 2, why: 'Idempotent tasks, dependencies, SLAs.' },
    { code: 'S9', name: 'Serving and real-time analytics', priority: 2, why: 'OLAP stores and pre-aggregation.' },
    { code: 'S11', name: 'Governance and privacy', priority: 3, why: 'PII, deletion and access control.' }
  ];

  function c(topic, title, o) {
    items.push({ id: 's-' + slug(title), track: 'sd', topic, title, type: 'concept', links: o && o.links || [], text: o && o.text || '' });
  }
  function design(title, prompt, followUps, fits) {
    items.push({ id: 's-' + slug(title), track: 'sd', topic: 'SX', title, type: 'case', links: [], text: prompt, followUps, fits: fits || [] });
  }

  design('Real-time trip and surge metrics',
    'Compute supply, demand and price-multiplier inputs per city zone every 30 seconds from driver and rider events (millions of events per minute). Serve them to pricing and to live dashboards.',
    ['How do you handle late GPS events and out-of-order data?', 'What happens to the metrics when a Flink job restarts?', 'How would you replay a bad day without double counting?'], ['Uber']);
  design('Ad-click aggregation with exactly-once counts',
    'Aggregate clicks per ad per minute for billing and dashboards. Clicks arrive via Kafka; some are duplicates or fraudulent. Billing must never double count.',
    ['Where exactly does deduplication happen and what is its state size?', 'How do you reconcile streaming counts with a daily batch?', 'How do you handle a hot ad that gets 100x traffic?'], ['Google']);
  design('Payments transaction data platform with reconciliation',
    'Ingest card transactions from authorisation and settlement systems, build an analytics-ready ledger, and reconcile the two daily. Data is sensitive and regulated.',
    ['How do you prove every transaction is accounted for?', 'How do you protect card data across bronze, silver and gold layers?', 'What is your plan when settlement files arrive two days late?'], ['Visa']);
  design('Real-time fraud feature pipeline',
    'Compute features such as transactions per card in the last 5 minutes and distance from last transaction, available to a scoring service within 100 ms, and the same features offline for model training.',
    ['How do you keep online and offline features consistent?', 'How do you backfill a new feature over 2 years of history?', 'What is the failure mode if the feature store is slow?'], ['Visa', 'Uber']);
  design('CDC from sharded OLTP databases into a lakehouse',
    'Replicate 200 MySQL shards into a lakehouse with under 15 minutes freshness, supporting updates and deletes, with full history for audits.',
    ['How do you handle schema changes on the source?', 'Copy-on-write or merge-on-read, and why?', 'How do you bootstrap the initial snapshot without locking production?'], ['Databricks', 'Uber']);
  design('Transaction log for a lakehouse table format',
    'Design how a table format tracks files, versions and concurrent writers on object storage so readers always see a consistent snapshot.',
    ['How do two concurrent writers avoid corrupting the table?', 'How do you keep metadata fast with millions of files?', 'How do time travel and vacuum interact?'], ['Databricks']);
  design('Company-wide metrics platform',
    'Every team defines metrics differently. Design a platform where a metric such as weekly active users is defined once and computed consistently for dashboards, experiments and finance.',
    ['How do you version a metric definition?', 'How do you serve both daily batch and near-real-time values?', 'How do you get 50 teams to adopt it?'], ['Google', 'Atlassian']);
  design('Product clickstream analytics pipeline',
    'Collect web and mobile events from 500 million users, validate them, sessionise them and make them queryable within an hour, with raw retention of 13 months.',
    ['How do you enforce event schemas without blocking app releases?', 'How do you partition and cluster the tables?', 'What does it cost per month, roughly?'], ['Google']);
  design('Data quality and observability platform',
    'Design a platform that checks freshness, volume, schema and distribution of 20,000 tables and alerts the right owner before consumers notice.',
    ['How do you avoid alert fatigue?', 'How do you link a failed check to downstream impact?', 'Should checks block pipelines or only alert?'], []);
  design('Workflow orchestrator for 50,000 daily pipelines',
    'Design a scheduler like Airflow that runs 50,000 DAGs a day across teams, with retries, backfills, SLAs and cross-DAG dependencies.',
    ['How does the scheduler scale beyond one node?', 'How do you make backfills safe to rerun?', 'How do you isolate one noisy team?'], []);
  design('Feature store (online and offline)',
    'Design a feature store serving point-in-time-correct training data and low-latency online lookups for 300 models.',
    ['How do you guarantee no data leakage in training sets?', 'How do you choose the online store?', 'Who owns a feature and how is it deprecated?'], ['Uber']);
  design('GDPR deletion across a petabyte data lake',
    'Delete one user\'s data from every table, including raw immutable files and backups, within 30 days of request, and prove it.',
    ['How do you find every table holding the user\'s data?', 'Delete physically or crypto-shred?', 'How do you keep deletion cost low at scale?'], ['Visa']);
  design('Log ingestion and search platform',
    'Ingest 10 TB of service logs per day, searchable within 1 minute, with 30 days hot and 1 year cold retention.',
    ['How do you index for search while keeping cost down?', 'How do you handle a service that logs 100x more after a bug?', 'Hot, warm and cold tiers: where do the boundaries go?'], []);
  design('Streaming join of orders and payments with late data',
    'Join order events and payment events (either can arrive up to 24 hours late) to produce a paid-orders stream and an unmatched-orders report.',
    ['How large is your join state and how do you bound it?', 'What do you emit when a payment arrives 3 days late?', 'How do you test this?'], ['Uber']);
  design('Trending top-K over a stream',
    'Show the top 100 trending items per region over the last hour, updated every minute, from 1 million events per second.',
    ['Exact or approximate, and what error is acceptable?', 'How do you merge partial top-Ks across partitions?', 'How do you handle a region with very little traffic?'], ['Google']);
  design('Real-time OLAP dashboard at 1 million events per second',
    'Serve sub-second slice-and-dice queries on the last 7 days of event data for internal operations teams.',
    ['Pinot, Druid or ClickHouse, and why?', 'What do you pre-aggregate and what do you not?', 'How do you handle upserts?'], ['Uber']);
  design('Data catalogue and lineage service',
    'Design a service that discovers datasets, owners and column-level lineage across warehouses, lakes and BI tools.',
    ['Pull or push metadata collection?', 'How do you compute column-level lineage from SQL?', 'How do you keep it fresh and trusted?'], ['Atlassian']);
  design('Migrate an on-prem Hadoop platform to a cloud lakehouse',
    '3 PB on HDFS, 4,000 Hive and Spark jobs, 200 downstream consumers. Plan the migration with no data loss and minimal disruption.',
    ['How do you sequence the migration and validate parity?', 'What do you rebuild versus lift-and-shift?', 'How do you run both platforms in parallel and decide cut-over?'], ['Databricks']);
  design('Backfill 2 years of data for a changed metric',
    'A metric definition changed. Recompute 2 years of history for a 500 TB fact table without hurting production SLAs or cost budgets.',
    ['How do you split the work and track progress?', 'How do you swap old and new data atomically?', 'How do you validate the new numbers?'], []);
  design('Customer 360 with identity resolution',
    'Merge customer records from 15 sources with different ids into one profile with full history (SCD2), refreshed hourly.',
    ['How do you match records without a shared id?', 'What happens when two profiles must later be split?', 'How do you expose history to analysts?'], ['Visa']);

  c('S1', 'CAP and PACELC with real examples', { text: 'Place Kafka, Cassandra, a warehouse and a lakehouse table format on these trade-offs.' });
  c('S1', 'Replication: leader-follower, multi-leader, leaderless and quorums');
  c('S1', 'Partitioning: range versus hash, and hot keys');
  c('S1', 'Consistent hashing and rebalancing');
  c('S1', 'Event time, processing time, ordering and clock skew');
  c('S1', 'Idempotency and exactly-once effects in distributed writes');
  c('S1', 'Consensus (Raft) and why Kafka moved to KRaft');

  c('S3', 'Kafka partitions, consumer groups, offsets and rebalancing');
  c('S3', 'Kafka exactly-once: idempotent producer and transactions', { text: 'And what end-to-end exactly-once needs from the sink.' });
  c('S3', 'Windows, watermarks and allowed lateness');
  c('S3', 'Flink state, checkpoints and savepoints');
  c('S3', 'Backpressure: causes and handling');
  c('S3', 'Stream-stream and stream-table joins');

  c('S2', 'Spark execution: jobs, stages, tasks and shuffle');
  c('S2', 'Data skew: salting, AQE skew join and isolating hot keys');
  c('S2', 'Broadcast, sort-merge and shuffle hash joins');
  c('S2', 'Partition sizing, spill and memory tuning');
  c('S2', 'Incremental processing versus full recompute');

  c('S4', 'Parquet internals: row groups, encodings, statistics and pushdown');
  c('S4', 'Iceberg, Delta Lake and Hudi compared');
  c('S4', 'Small files problem and compaction strategy');
  c('S4', 'Partitioning versus clustering (Z-order, liquid clustering)');
  c('S4', 'Copy-on-write versus merge-on-read');

  c('S5', 'Choosing the grain of a fact table');
  c('S5', 'Star schema versus one big table');
  c('S5', 'SCD type 2 with MERGE at scale');
  c('S5', 'Late-arriving dimensions and facts');
  c('S5', 'Semantic or metrics layer for consistent definitions');

  c('S6', 'Log-based CDC versus query-based extraction');
  c('S6', 'Schema evolution and schema registry compatibility modes');
  c('S6', 'Backfills without double counting');
  c('S6', 'Deduplication at ingestion versus at read');

  c('S13', 'SLOs for data: freshness, completeness and correctness');
  c('S13', 'Self-serve data platform: multi-tenancy, quotas and isolation');
  c('S13', 'Central platform versus data mesh: who owns what');
  c('S13', 'Leading a cross-team migration: sequencing, parity checks, cut-over');
  c('S13', 'Cost governance: chargeback, budgets and per-team cost visibility');
  c('S13', 'Writing a design doc that gets approved: options, trade-offs, decision');
  c('S12', 'Back-of-envelope: events per day to TB per year', { text: 'Practise: 2 billion events a day at 1 KB, compressed 5x, kept 13 months.' });
  c('S12', 'Storage tiering and lifecycle policies');
  c('S12', 'Cost per query and how to cut it');

  c('S8', 'Data contracts between producers and consumers');
  c('S8', 'Freshness, volume, schema and distribution checks');
  c('S8', 'Lineage and impact analysis');

  c('S7', 'Idempotent tasks and data-interval semantics');
  c('S7', 'Cross-team dependencies and SLAs');
  c('S7', 'Event-driven versus scheduled pipelines');

  c('S9', 'Pinot, Druid and ClickHouse: when to use which');
  c('S9', 'Pre-aggregation, rollups and cubes');
  c('S9', 'Lambda versus Kappa architecture');

  c('S11', 'PII tokenisation and encryption');
  c('S11', 'Deleting data from immutable storage');
  c('S11', 'Row- and column-level access control');


  // ---------- Habit ladder ----------
  const levels = [
    { n: 1, name: 'Show up', sd: 10, dsa: 10, min: 5, need: 10, dsaDiff: ['Easy'],
      sdMode: 'concept', sdHow: 'Watch one short video or read about one concept for 10 minutes.', dsaHow: 'One Easy question. Reading the solution is fine at this level.' },
    { n: 2, name: 'Build the habit', sd: 20, dsa: 15, min: 10, need: 14, dsaDiff: ['Easy', 'Medium'],
      sdMode: 'concept', sdHow: 'Read or watch, then write a 5-line summary in your own words.', dsaHow: 'Easy or Medium. Try 15 minutes before any hint.' },
    { n: 3, name: 'Go deeper', sd: 30, dsa: 25, min: 15, need: 28, dsaDiff: ['Medium', 'Easy'],
      sdMode: 'case-part', sdHow: 'Practise one part of a design case, out loud, then note what you missed.', dsaHow: 'Medium, 25-minute limit, explain out loud.' },
    { n: 4, name: 'Interview pace', sd: 45, dsa: 30, min: 20, need: 0, dsaDiff: ['Medium', 'Hard'],
      sdMode: 'case-full', sdHow: 'Full design case in 45 to 60 minutes, then score it with the staff rubric.', dsaHow: 'Medium or Hard under interview conditions, no autocomplete.' }
  ];
  const sdCurriculum = ['S1', 'S4', 'S3', 'S2', 'S5', 'S6', 'S13', 'S12', 'S8', 'S7', 'S9', 'S11'];
  const rubric = ['Scoped it: consumers, freshness, correctness, scale', 'Sized it: events/s, TB/day, rough cost', 'Named trade-offs and what is given up', 'Correct under failure: idempotency, late data, replays, backfills', 'Operable: SLOs, data quality, alerting', 'Platform view: ownership, contracts, multi-team', 'Path from today to the target design'];

  // ---------- Quotes (original lines; {name} = daughter's name from My why) ----------
  const quotes = {
    habit: [
      'The scroll will still be there tomorrow. This chance might not.',
      'One year from now you will wish you had started today. So start.',
      'The 2027 offer is decided by what you do tonight.',
      'Phone down. Timer on. Ten minutes wins the day.',
      'Busy is not a reason. It is a calendar problem. Fix the calendar.',
      'Nobody is coming to hand you this job. You walk in prepared, or you do not walk in.',
      'The engineer who gets the offer kept going on the days he did not feel like it.',
      'Motivation leaves. Systems stay. Start the timer.',
      'You have waited long enough for the right time. This is it.',
      'Every wasted evening is a vote for staying where you are.',
      'Small today, unstoppable in a year.',
      'Comfort is expensive. It costs you the life you could have had.'
    ],
    sd: [
      'Staff engineers are not paid to know tools. They are paid to make the right call when nothing is certain.',
      'Your years of production fires are your edge. Turn every one into a design story.',
      'At staff level the question is not "can you build it?" It is "should we, and what breaks at 10x?"',
      'Numbers first. A design without estimates is an opinion.',
      'Every trade-off you say out loud is worth more than a box you draw.',
      'Idempotent, replayable, observable. Say all three in every design.',
      'Exactly-once is a promise. Know what it costs before you make it.',
      'Design for the day the backfill runs, the region dies and the schema changes. All at once.',
      'Seniors answer the question. Staff engineers fix the question first.',
      'Own the first eight minutes: consumers, freshness, correctness, scale.'
    ],
    dsa: [
      'DSA is the gate. Walk through it calmly, then let system design win the room.',
      '25 minutes. Python. Out loud. Repeat until it is boring.',
      'If you needed the solution, it is not solved. It is scheduled.',
      'Name the pattern before you write a line.',
      'Every dedup you code today is an incident you can explain tomorrow.',
      'Easy builds the reflex. Medium builds the nerve. Both count today.'
    ],
    family: [
      '{name} will never know about the nights you studied. She will only know the life you gave her.',
      'She is only small once. Build the future now, so you can be there for all of it later.',
      'Every concept you master today is a school fee you will never have to worry about.',
      '{name} deserves a father who did not settle. Be him today.',
      'Her first school, her first trip, her biggest dream. Start paying for them with this hour.',
      'You are not studying for an interview. You are building the life {name} grows up in.',
      '{name} is watching how you handle hard things. Show her.',
      'One day {name} will ask how you did it. Make today part of the answer.',
      'The offer letter is the milestone. A better life for {name} is the point.',
      'Close the laptop on time tonight. {name} needs you more than the timer does.'
    ],
    switch: [
      'You are not starting from zero. You are starting from {years} years. Prepare like it.',
      '{years} years of building real systems is your edge. Product interviews only test it in a different language.',
      'Service work taught you to deliver. Product interviews ask you to decide. Practise deciding out loud.',
      'The gap is not knowledge. It is interview practice, and that gap closes one session at a time.',
      'Nobody in a Google or Uber loop will ask where you worked. They will ask how you think. Show them.',
      'Every staff engineer at a product company once sat where you are, deciding to prepare.',
      'Your experience got you this far. Your preparation decides what comes next.',
      'You have fixed production at 2 am for clients. You can handle a 45-minute design round.'
    ],
    comeback: [
      'You missed yesterday. Do not let it become two. Ten minutes, now.',
      'Falling off is not failure. Staying off is.',
      'The streak broke. Your reason did not. Start again.',
      'No guilt. No drama. Just the next session.'
    ]
  };
  const milestones = {
    3: 'Three days in a row. The habit has started.',
    7: 'One full week. Most people never get here.',
    14: 'Two weeks. This is becoming who you are.',
    21: 'Three weeks without missing. {name} has a father who keeps his word.',
    30: 'Thirty days. A month of proof.',
    50: 'Fifty days. Interviewers can feel this kind of preparation.',
    75: 'Seventy-five days. You are not the same engineer you were.',
    100: 'One hundred days. Whatever happens next, you built this.'
  };

  window.DL_DATA = {
    dsaTopics, sdTopics, items, levels, sdCurriculum, rubric, quotes, milestones,
    resources: [
      { name: 'NeetCode practice lists', url: 'https://neetcode.io/practice' },
      { name: 'NeetCode roadmap', url: 'https://neetcode.io/roadmap' },
      { name: 'NeetCode on YouTube (free video solutions)', url: 'https://www.youtube.com/@NeetCode' },
      { name: 'Aced, formerly Exponent (your course)', url: 'https://www.aced.io/' },
      { name: 'Designing Data-Intensive Applications (book site)', url: 'https://dataintensive.net/' },
      { name: 'Uber Engineering blog', url: 'https://www.uber.com/blog/engineering/' },
      { name: 'Databricks blog', url: 'https://www.databricks.com/blog' }
    ]
  };
})();
