// ask_user 调用质量校验器：在 brainAgent 把 ask_user 抛给用户之前做一道体检
// 只拦住"明显不合格"的追问，不做语义层挑剔
//
// 触发返回 { valid: false, error, guidance } 时，brainAgent 应该把结果作为
// tool_result 压回消息流，并附一条 user 消息教模型怎么改，然后 continue 循环
// 让 LLM 重造一次合格的 ask_user。

const VALID_TYPES = new Set(['missing_info', 'ambiguous', 'confirmation', 'suggestion']);

const MIN_QUESTION_LEN = 5;
const MIN_OPTION_DESCRIPTION_LEN = 8;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

function clean(str) {
  return typeof str === 'string' ? str.trim() : '';
}

function validateAskUserArgs(args = {}) {
  const question = clean(args.question);
  const type = clean(args.type);
  const options = Array.isArray(args.options) ? args.options : [];

  // 1. question 必须存在且不能太短
  if (question.length < MIN_QUESTION_LEN) {
    return {
      valid: false,
      error: 'question 字段缺失或过短',
      guidance: 'ask_user 的 question 必须是一句完整的问题（至少 5 个字）。请重新构造，遵循"深问四杠杆"：先亮假设再确认 / 问取舍不问需求 / 挖动机 / options 带代价。'
    };
  }

  // 2. type 必须是合法枚举
  if (type && !VALID_TYPES.has(type)) {
    return {
      valid: false,
      error: `type 字段非法：${type}`,
      guidance: `type 只能是 missing_info / ambiguous / confirmation / suggestion 其中之一。`
    };
  }

  // 3. type=suggestion 时必须带 options，否则退化成开放题，违背"给取舍"原则
  if (type === 'suggestion' && options.length === 0) {
    return {
      valid: false,
      error: 'type=suggestion 但未提供 options',
      guidance: 'suggestion 类问题的价值就是让用户在差异明确的选项里拍一条。请补 2-4 个 options，每个 description 写清"选它要承担什么代价"。'
    };
  }

  // 4. options 校验：有就得达标
  if (options.length > 0) {
    // 4a. 数量必须在 2-4 之间（1 个选项等于没选项）
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      return {
        valid: false,
        error: `options 数量不合法（${options.length}）`,
        guidance: `options 必须是 2-4 条。1 条等于没选项；5+ 条用户会被劝退。请收敛到最关键的几个分支。`
      };
    }

    // 4b. 每个 option 必须有 label + value + 有质量的 description
    for (let i = 0; i < options.length; i++) {
      const opt = options[i] || {};
      const label = clean(opt.label);
      const value = clean(opt.value);
      const description = clean(opt.description);

      if (!label) {
        return {
          valid: false,
          error: `options[${i}] 缺少 label`,
          guidance: `每个 option 必须有 label（1-12 字的短标题）。`
        };
      }
      if (!value) {
        return {
          valid: false,
          error: `options[${i}] 缺少 value`,
          guidance: `每个 option 必须有 value（用户点击后回传的文本，通常和 label 一致或更完整）。`
        };
      }
      if (description.length < MIN_OPTION_DESCRIPTION_LEN) {
        return {
          valid: false,
          error: `options[${i}]("${label}") 的 description 过短或缺失`,
          guidance: `每个 option.description 必须写清"选这个要承担什么代价/放弃什么"，至少 ${MIN_OPTION_DESCRIPTION_LEN} 个字。禁止出现"按这个继续""换个思路"这种零增量复述。参考格式："收益 X；代价 Y"。`
        };
      }
    }
  }

  return { valid: true };
}

module.exports = { validateAskUserArgs };
