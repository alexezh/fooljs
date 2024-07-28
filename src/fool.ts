type Concept = {
  innerName: string;
  outerName?: string;
}

type Clause = {

}

class Program {
  public addClause() {

  }
}

/**
 * facts:
 *  count_my_hand
 *  count_opp_hand
 * 
 * as we build steps, we make stream of actions into buffer against imaginary board
 * we can then take first action and materialize it
 * 
 * action:
 *   take(x):
 *     
 *   play_card(x)
 * 
 *    good_card
 *      distribution based on what we've seen and stage of game
 *      trump is good card
 *      has pair
 *      other left
 * 
 *    good_hand
 *      2-3 trumps
 *      high trumps left
 * 
 * goal - 
 *    play small card first
 *    keep trump to the end of the game
 *    make people take pile of low cards
 *    make people play good cards
 *      go with suit or card which people need good card
 * 
 * attack - 
 *    drop low cards
 *    play suit which opponent does not have to take trumps
 *    
 * 
 * elements:
 *    trick
 *    pile
 *    trump
 *    hand
 *    opponent prediction
 *    planning
 * 
 * defend -
 *    take_pile
 *      cannot_beat_trick
 *      pile_good
 *      hand bad
 *      opponent has more
 *      opponent needs drop bad
 *      
 *      
 *    play_card
 * 
 * clauses:
 *    is_higher(x, y)
 * 
 *    
 * 
 *    next_card => hand_smallest | double
 */