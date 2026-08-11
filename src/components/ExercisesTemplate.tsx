import React from 'react';
import './ExercisesTemplate.css';
import {
  fillBlanksForTranslate,
  firstCanonicalSolution,
  indicesFromAnswer,
  textAnswerMatches,
} from '../features/exercises/answerUtils';
import type {
  ExerciseType,
  FillInBlankExercise,
  MultipleChoiceExercise,
  SentenceBuildingExercise,
  TextSolutionEntry,
  TrueFalseExercise,
  WordOrderExercise,
} from '../features/exercises/types';

export type { ExerciseType } from '../features/exercises/types';

const TranslateIcon: React.FC<{
  text: string;
  onTranslate?: (text: string, opts?: { wholeSentence?: boolean }) => void;
  wholeSentence?: boolean;
}> = ({ text, onTranslate, wholeSentence }) => {
  if (!onTranslate) return null;
  return (
    <button
      className="et-translate-btn"
      onClick={(e) => {
        e.stopPropagation();
        onTranslate(text, wholeSentence ? { wholeSentence: true } : undefined);
      }}
      title="Translate"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="black">
        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    </button>
  );
};

interface ExercisesTemplateProps {
  type?: ExerciseType;
  title: string;
  submitted?: boolean;
  onTranslate?: (text: string, opts?: { wholeSentence?: boolean }) => void;
  /** When true: fill-in-blank translates raw sentence (blanks kept, hints stripped); true/false translates whole statement. Used by reading/listening. */
  rawTranslate?: boolean;
  [key: string]: unknown;
}

const WordOrderRow: React.FC<{
  words: string[];
  index: number;
  answer: string;
  solution: TextSolutionEntry;
  submitted?: boolean;
  onAnswerChange: (index: number, value: string) => void;
  onTranslate?: (text: string, opts?: { wholeSentence?: boolean }) => void;
}> = ({ words, index, answer, solution, submitted, onAnswerChange, onTranslate }) => {
  const placedIndices = indicesFromAnswer(words, answer);
  const isCorrect = submitted && textAnswerMatches(answer, solution);
  const isIncorrect = submitted && !isCorrect;

  const syncAnswer = (indices: number[]) => {
    onAnswerChange(index, indices.map((i) => words[i]).join(' '));
  };

  const handleBankTap = (wordIndex: number) => {
    if (submitted) return;
    syncAnswer([...placedIndices, wordIndex]);
  };

  const handleSolutionTap = (position: number) => {
    if (submitted) return;
    syncAnswer(placedIndices.filter((_, i) => i !== position));
  };

  const availableIndices = words
    .map((_, i) => i)
    .filter((i) => !placedIndices.includes(i));

  return (
    <div
      className={`et-word-order-question ${
        submitted ? (isCorrect ? 'et-correct' : 'et-incorrect') : ''
      }`}
    >
      <div className="et-word-order-bank-panel">
        <span className="et-word-order-badge">{index + 1}.</span>
        <div className="et-word-bank">
          {availableIndices.length === 0 ? (
            <span className="et-word-order-hint">No words left</span>
          ) : (
            availableIndices.map((wordIndex) => (
              <button
                key={wordIndex}
                type="button"
                className="et-word-chip"
                onClick={() => handleBankTap(wordIndex)}
                disabled={submitted}
              >
                {words[wordIndex]}
              </button>
            ))
          )}
        </div>
        {onTranslate && (
          <div className="et-word-order-translate">
            <TranslateIcon
              text={firstCanonicalSolution(solution)}
              onTranslate={onTranslate}
              wholeSentence
            />
          </div>
        )}
      </div>
      <div
        className={`et-word-order-solution-panel ${
          isCorrect ? 'et-solution-correct' : isIncorrect ? 'et-solution-incorrect' : ''
        }`}
      >
        {placedIndices.length === 0 ? (
          <span className="et-word-order-hint">Tap words above to build your sentence</span>
        ) : (
          placedIndices.map((wordIndex, pos) => (
            <button
              key={`${wordIndex}-${pos}`}
              type="button"
              className="et-word-chip et-word-chip-placed"
              onClick={() => handleSolutionTap(pos)}
              disabled={submitted}
            >
              {words[wordIndex]}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export const ExercisesTemplate: React.FC<ExercisesTemplateProps> = (props) => {
  const { title } = props;
  const renderQuestionWithTranslate = (
    content: React.ReactNode,
    translateText: string,
    wholeSentence?: boolean
  ) => (
    <div className="et-question-with-translate">
      <div className="et-question-text">{content}</div>
      {props.onTranslate && (
        <div className="et-translate-box">
          <TranslateIcon
            text={translateText}
            onTranslate={props.onTranslate}
            wholeSentence={wholeSentence}
          />
        </div>
      )}
    </div>
  );

  const renderInstructionBox = () => {
    if (!title) return null;
    return (
      <div className="et-instruction-box">
        <label className="et-instruction-label">Instruction</label>
        <p className="et-instruction-text">{title}</p>
      </div>
    );
  };

  const renderFillInBlank = (exercise: FillInBlankExercise) => (
    <div>
      {renderInstructionBox()}
      <table className="et-exercise-table">
      <tbody>
        {exercise.exercises.map((ex, index) => {
          const sol = exercise.solutions[index];
          const answerStr = Array.isArray(sol) ? sol[0] : sol;
          const translateSource = props.rawTranslate
            ? ex.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
            : fillBlanksForTranslate(ex, answerStr ?? '');
          return (
          <tr key={index} className="et-exercise-row">
            <td className="et-question-cell">{renderQuestionWithTranslate(ex, translateSource, true)}</td>
            <td className="et-answer-cell">
              <input
                type="text"
                className={`et-exercise-input ${
                  props.submitted 
                    ? (textAnswerMatches(exercise.answers[index], exercise.solutions[index]) 
                        ? 'et-correct' 
                        : 'et-incorrect') 
                    : ''
                }`}
                value={exercise.answers[index]}
                onChange={(e) => exercise.onAnswerChange(index, e.target.value)}
                placeholder="Your answer..."
              />
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );

  const renderTrueFalse = (exercise: TrueFalseExercise) => (
    <div className="et-true-false-container">
      {renderInstructionBox()}
      {exercise.text && exercise.text.trim() && (
        <div className="et-reading-text">
          <h4>Text:</h4>
          <div className="et-reading-text-content">
            {renderQuestionWithTranslate(exercise.text, exercise.text)}
          </div>
        </div>
      )}
      <div className="et-statements-container">
        {exercise.statements.map((statement, index) => (
          <div key={index} className={`et-statement-row ${props.submitted ? ((exercise.answers[index] === exercise.solutions[index]) ? 'et-correct' : 'et-incorrect') : ''}`}>
            <div className="et-statement-text">{renderQuestionWithTranslate(`${index + 1}. ${statement}`, statement, props.rawTranslate)}</div>
            <div className="et-true-false-buttons">
              <button
                className={`et-tf-btn ${exercise.answers[index] === true ? 'et-tf-selected' : ''}`}
                onClick={() => exercise.onAnswerChange(index, true)}
              >
                True
              </button>
              <button
                className={`et-tf-btn ${exercise.answers[index] === false ? 'et-tf-selected' : ''}`}
                onClick={() => exercise.onAnswerChange(index, false)}
              >
                False
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMultipleChoice = (exercise: MultipleChoiceExercise) => (
    <div className="et-multiple-choice-container">
      {renderInstructionBox()}
      {exercise.exercises.map((ex, index) => (
        <div key={index} className={`et-mc-question ${props.submitted ? ((exercise.answers[index] === exercise.solutions[index]) ? 'et-correct' : 'et-incorrect') : ''}`}>
          <div className="et-mc-question-text">
            {renderQuestionWithTranslate(
              `${index + 1}. ${ex.question}`,
              fillBlanksForTranslate(
                ex.question,
                ex.options[exercise.solutions[index]] ?? ''
              ),
              true
            )}
          </div>
          <div className="et-mc-options">
            {ex.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                className={`et-mc-option ${exercise.answers[index] === optionIndex ? 'et-mc-selected' : ''}`}
                onClick={() => exercise.onAnswerChange(index, optionIndex)}
              >
                {String.fromCharCode(97 + optionIndex)}) {option}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderSentenceBuilding = (exercise: SentenceBuildingExercise) => {
    return (
      <div>
        {renderInstructionBox()}
        <table className="et-exercise-table">
          <tbody>
            {exercise.prompts.map((prompt, index) => (
              <tr key={index} className="et-exercise-row">
                <td className="et-question-cell">
                  <div className="et-word-prompts">
                    {renderQuestionWithTranslate(
                      prompt,
                      firstCanonicalSolution(exercise.solutions[index]),
                      true
                    )}
                  </div>
                </td>
                <td className="et-answer-cell">
                  <input
                    type="text"
                    className={`et-exercise-input ${
                      props.submitted 
                        ? (textAnswerMatches(exercise.answers[index], exercise.solutions[index]) 
                            ? 'et-correct' 
                            : 'et-incorrect') 
                        : ''
                    }`}
                    value={exercise.answers[index]}
                    onChange={(e) => exercise.onAnswerChange(index, e.target.value)}
                    placeholder="Build your sentence..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderWordOrder = (exercise: WordOrderExercise) => (
    <div className="et-word-order-container">
      {renderInstructionBox()}
      {exercise.jumbledWords.map((words, index) => (
        <WordOrderRow
          key={index}
          words={words}
          index={index}
          answer={exercise.answers[index] ?? ''}
          solution={exercise.solutions[index]}
          submitted={props.submitted}
          onAnswerChange={exercise.onAnswerChange}
          onTranslate={props.onTranslate}
        />
      ))}
    </div>
  );

  const renderExerciseContent = () => {
    switch (props.type) {
      case 'FILL_IN_THE_BLANK_READING_WRITING':
        return renderFillInBlank(props as unknown as FillInBlankExercise);
      case 'TRUE_FALSE_READING':
        return renderTrueFalse(props as unknown as TrueFalseExercise);
      case 'MULTIPLE_CHOICE_READING':
        return renderMultipleChoice(props as unknown as MultipleChoiceExercise);
      case 'SENTENCE_BUILDING_WRITING':
        return renderSentenceBuilding(props as unknown as SentenceBuildingExercise);
      case 'WORD_ORDER_WRITING':
        return renderWordOrder(props as unknown as WordOrderExercise);
      default:
        return null;
    }
  };

  return (
    <div className="et-exercises">
      {renderExerciseContent()}
    </div>
  );
};
